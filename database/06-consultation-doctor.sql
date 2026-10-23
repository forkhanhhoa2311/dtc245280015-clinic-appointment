BEGIN;

INSERT INTO users (full_name, email, password_hash, phone, role)
VALUES (
    'Phạm Minh Đức',
    'duc.doctor@clinic.local',
    'DEMO_HASH_DO_NOT_USE_IN_PRODUCTION',
    '0901000004',
    'doctor'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO doctors (
    user_id, specialty_id, qualification,
    experience_years, consultation_fee
)
SELECT u.id, sp.id, 'Bác sĩ tư vấn sức khỏe', 7, 150000
FROM users u
JOIN specialties sp ON sp.name = 'Nội tổng quát'
WHERE u.email = 'duc.doctor@clinic.local'
ON CONFLICT (user_id) DO NOTHING;

-- Chỉ thay đổi phân công dịch vụ, giữ nguyên lịch hẹn đã có.
DELETE FROM doctor_services
WHERE service_id = (
    SELECT id FROM services WHERE name = 'Tư vấn sức khỏe'
);

INSERT INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN users u ON u.id = d.user_id
CROSS JOIN services s
WHERE u.email = 'duc.doctor@clinic.local'
  AND s.name = 'Tư vấn sức khỏe'
ON CONFLICT DO NOTHING;

-- Tạo khung giờ demo cho bác sĩ mới vào ngày mai, theo giờ Việt Nam.
INSERT INTO appointment_slots (
    doctor_id, slot_date, start_time, end_time
)
SELECT
    d.id,
    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1,
    t.start_time,
    t.end_time
FROM doctors d
JOIN users u ON u.id = d.user_id
CROSS JOIN (
    VALUES
        (TIME '08:00', TIME '08:20'),
        (TIME '08:20', TIME '08:40'),
        (TIME '08:40', TIME '09:00'),
        (TIME '14:00', TIME '14:20')
) AS t(start_time, end_time)
WHERE u.email = 'duc.doctor@clinic.local'
ON CONFLICT (doctor_id, slot_date, start_time, end_time)
DO NOTHING;

COMMIT;
