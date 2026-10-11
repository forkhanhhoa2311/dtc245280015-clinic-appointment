const express = require("express");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST || "postgres",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

app.use(express.json());

/*
 * Health check
 * Dùng cho Docker, monitoring và kiểm tra hệ thống.
 */
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      database: "connected"
    });
  } catch (error) {
    console.error("Health check failed:", error);

    res.status(503).json({
      status: "error",
      database: "disconnected"
    });
  }
});

/*
 * GET /api/services
 * Danh sách dịch vụ khám đang hoạt động.
 */
app.get("/api/services", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        duration_minutes,
        price
      FROM services
      WHERE is_active = TRUE
      ORDER BY name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Get services failed:", error);

    res.status(500).json({
      error: "Không thể lấy danh sách dịch vụ"
    });
  }
});

/*
 * GET /api/specialties
 * Danh sách chuyên khoa.
 */
app.get("/api/specialties", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description
      FROM specialties
      ORDER BY name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Get specialties failed:", error);

    res.status(500).json({
      error: "Không thể lấy danh sách chuyên khoa"
    });
  }
});

/*
 * GET /api/doctors
 * Danh sách bác sĩ kèm chuyên khoa.
 */
app.get("/api/doctors", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id,
        u.full_name,
        u.email,
        u.phone,
        s.id AS specialty_id,
        s.name AS specialty_name,
        d.qualification,
        d.experience_years,
        d.consultation_fee
      FROM doctors d
      JOIN users u
        ON u.id = d.user_id
      JOIN specialties s
        ON s.id = d.specialty_id
      ORDER BY u.full_name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Get doctors failed:", error);

    res.status(500).json({
      error: "Không thể lấy danh sách bác sĩ"
    });
  }
});

/*
 * GET /api/doctors/:id/slots
 * Lấy các khung giờ còn trống của một bác sĩ.
 *
 * Có thể lọc theo ngày:
 * /api/doctors/1/slots?date=2026-10-05
 */
app.get("/api/doctors/:id/slots", async (req, res) => {
  const doctorId = Number(req.params.id);
  const { date } = req.query;

  if (!Number.isInteger(doctorId)) {
    return res.status(400).json({
      error: "doctor_id không hợp lệ"
    });
  }

  try {
    let query = `
      SELECT
        id,
        doctor_id,
        slot_date,
        start_time,
        end_time,
        is_available
      FROM appointment_slots
      WHERE doctor_id = $1
  	AND is_available = TRUE
  	AND (slot_date + start_time)
	    > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')
    `;

    const params = [doctorId];

    if (date) {
      query += ` AND slot_date = $2`;
      params.push(date);
    }

    query += `
      ORDER BY slot_date, start_time
    `;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error("Get slots failed:", error);

    res.status(500).json({
      error: "Không thể lấy danh sách khung giờ"
    });
  }
});

/*
 * POST /api/appointments
 *
 * Tạo lịch hẹn.
 *
 * Body:
 * {
 *   "patient_id": 1,
 *   "doctor_id": 1,
 *   "service_id": 1,
 *   "slot_id": 1,
 *   "reason": "Khám tổng quát"
 * }
 */
/*
 * POST /api/patients
 *
 * Tìm bệnh nhân theo email hoặc tạo bệnh nhân mới.
 */
app.post("/api/patients", async (req, res) => {
  const {
    full_name,
    email,
    phone
  } = req.body;

  if (!full_name || !email || !phone) {
    return res.status(400).json({
      error: "Vui lòng nhập đầy đủ họ tên, email và số điện thoại"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Kiểm tra user patient đã tồn tại theo email
    const existingUser = await client.query(
      `
      SELECT
        u.id AS user_id,
        p.id AS patient_id
      FROM users u
      LEFT JOIN patients p
        ON p.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1)
        AND u.role = 'patient'
      LIMIT 1
      `,
      [email.trim()]
    );

    if (existingUser.rows.length > 0) {
      const patient = existingUser.rows[0];

      // Cập nhật thông tin mới nhất
      await client.query(
        `
        UPDATE users
        SET
          full_name = $1,
          phone = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        `,
        [
          full_name.trim(),
          phone.trim(),
          patient.user_id
        ]
      );

      await client.query("COMMIT");

      return res.json({
        patient_id: patient.patient_id,
        existing: true
      });
    }

    // Tạo user mới
    const userResult = await client.query(
      `
      INSERT INTO users (
        full_name,
        email,
        password_hash,
        phone,
        role
      )
      VALUES ($1, $2, $3, $4, 'patient')
      RETURNING id
      `,
      [
        full_name.trim(),
        email.trim(),
        "DEMO_HASH_DO_NOT_USE_IN_PRODUCTION",
        phone.trim()
      ]
    );

    const userId = userResult.rows[0].id;

    // Tạo hồ sơ patient tương ứng
    const patientResult = await client.query(
      `
      INSERT INTO patients (user_id)
      VALUES ($1)
      RETURNING id
      `,
      [userId]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      patient_id: patientResult.rows[0].id,
      existing: false
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create/find patient failed:", error);

    return res.status(500).json({
      error: "Không thể tạo hoặc tìm bệnh nhân"
    });
  } finally {
    client.release();
  }
});
app.post("/api/appointments", async (req, res) => {
  const {
    patient_id,
    doctor_id,
    service_id,
    slot_id,
    reason
  } = req.body;

  if (
    !patient_id ||
    !doctor_id ||
    !service_id ||
    !slot_id
  ) {
    return res.status(400).json({
      error: "Thiếu thông tin bắt buộc"
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Khóa slot để tránh hai người
     * đặt cùng một khung giờ.
     */
    const slotResult = await client.query(
      `
      SELECT
  	id,
	doctor_id,
	is_available,
  	(
    	  (slot_date + start_time)
    	  > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')
  	) AS is_future
      FROM appointment_slots
      WHERE id = $1
      FOR UPDATE
      `,
      [slot_id]
    );

    if (slotResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Không tìm thấy khung giờ"
      });
    }

    const slot = slotResult.rows[0];
    if (!slot.is_future) {
  await client.query("ROLLBACK");

  return res.status(400).json({
    error: "Khung giờ đã qua, vui lòng chọn thời gian khác"
  });
    }
    if (!slot.is_available) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "Khung giờ này đã được đặt"
      });
    }

    if (Number(slot.doctor_id) !== Number(doctor_id)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Khung giờ không thuộc bác sĩ đã chọn"
      });
    }

    const appointmentResult = await client.query(
      `
      INSERT INTO appointments (
        patient_id,
        doctor_id,
        service_id,
        slot_id,
        status,
        reason
      )
      VALUES ($1, $2, $3, $4, 'pending', $5)
      RETURNING *
      `,
      [
        patient_id,
        doctor_id,
        service_id,
        slot_id,
        reason || null
      ]
    );

    await client.query(
      `
      UPDATE appointment_slots
      SET is_available = FALSE
      WHERE id = $1
      `,
      [slot_id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Đặt lịch thành công",
      appointment: appointmentResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create appointment failed:", error);

    res.status(500).json({
      error: "Không thể tạo lịch hẹn"
    });
  } finally {
    client.release();
  }
});

/*
 * GET /api/appointments/:id
 * Xem thông tin một lịch hẹn.
 */
app.get("/api/appointments/:id", async (req, res) => {
  const appointmentId = Number(req.params.id);

  if (!Number.isInteger(appointmentId)) {
    return res.status(400).json({
      error: "appointment_id không hợp lệ"
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        a.id,
        a.status,
        a.reason,
        a.created_at,
        a.updated_at,

        p.id AS patient_id,
        pu.full_name AS patient_name,

        d.id AS doctor_id,
        du.full_name AS doctor_name,

        s.id AS service_id,
        s.name AS service_name,
        s.duration_minutes,
        s.price,

        sl.id AS slot_id,
        sl.slot_date,
        sl.start_time,
        sl.end_time

      FROM appointments a

      JOIN patients p
        ON p.id = a.patient_id

      JOIN users pu
        ON pu.id = p.user_id

      JOIN doctors d
        ON d.id = a.doctor_id

      JOIN users du
        ON du.id = d.user_id

      JOIN services s
        ON s.id = a.service_id

      JOIN appointment_slots sl
        ON sl.id = a.slot_id

      WHERE a.id = $1
      `,
      [appointmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Không tìm thấy lịch hẹn"
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get appointment failed:", error);

    res.status(500).json({
      error: "Không thể lấy thông tin lịch hẹn"
    });
  }
});

/*
 * PATCH /api/appointments/:id/status
 *
 * Cập nhật trạng thái:
 * pending
 * confirmed
 * completed
 * cancelled
 */
app.patch("/api/appointments/:id/status", async (req, res) => {
  const appointmentId = Number(req.params.id);
  const { status } = req.body;

  const allowedStatuses = [
    "pending",
    "confirmed",
    "completed",
    "cancelled"
  ];

  if (!Number.isInteger(appointmentId)) {
    return res.status(400).json({
      error: "appointment_id không hợp lệ"
    });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: "Trạng thái không hợp lệ"
    });
  }

  try {
    const result = await pool.query(
      `
      UPDATE appointments
      SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
      `,
      [status, appointmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Không tìm thấy lịch hẹn"
      });
    }

    res.json({
      message: "Cập nhật trạng thái thành công",
      appointment: result.rows[0]
    });
  } catch (error) {
    console.error("Update appointment status failed:", error);

    res.status(500).json({
      error: "Không thể cập nhật trạng thái lịch hẹn"
    });
  }
});

/*
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: "API endpoint không tồn tại"
  });
});

/*
 * Global error handler
 */
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  res.status(500).json({
    error: "Internal server error"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Clinic Appointment API running on port ${PORT}`);
});
