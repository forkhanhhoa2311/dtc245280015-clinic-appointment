const API_BASE = "/api";

const serviceSelect = document.getElementById("service");
const doctorSelect = document.getElementById("doctor");
const dateInput = document.getElementById("appointment-date");
const slotsContainer = document.getElementById("slots");
const bookingButton = document.getElementById("booking-btn");
const message = document.getElementById("message");
const confirmation = document.getElementById("confirmation");
const confirmationContent = document.getElementById("confirmation-content");

let selectedSlot = null;

function clearBookingResult() {
    confirmation.classList.add("hidden");
    confirmationContent.replaceChildren();
    message.textContent = "";
    message.className = "message hidden";
}

function addConfirmationLine(label, value) {
    const paragraph = document.createElement("p");
    const title = document.createElement("strong");
    title.textContent = label + ": ";
    paragraph.append(title, document.createTextNode(String(value ?? "")));
    confirmationContent.appendChild(paragraph);
}

dateInput.min = getTodayVietnam();
let services = [];
let doctors = [];
// Ngày hiện tại theo giờ Việt Nam.
function getTodayVietnam() {
    return new Date(Date.now() + 7 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
}

// Khung giờ chỉ hợp lệ khi chưa bắt đầu.
function isFutureSlot(date, time) {
    if (!date || !time) return false;

    const start = new Date(
        `${date}T${time.slice(0, 8)}+07:00`
    );

    return start.getTime() > Date.now();
}

// Không cho chọn ngày trước hôm nay.
dateInput.min = getTodayVietnam();
// =========================
// Load services
// =========================
async function loadServices() {
    try {
        const response = await fetch(`${API_BASE}/services`);

        if (!response.ok) {
            throw new Error("Không thể tải danh sách dịch vụ");
        }

        services = await response.json();

        serviceSelect.innerHTML =
            '<option value="">-- Chọn dịch vụ --</option>';

        services.forEach(service => {
            const option = document.createElement("option");

            option.value = service.id;
            option.textContent =
                `${service.name} - ${Number(service.price).toLocaleString("vi-VN")}đ`;

            serviceSelect.appendChild(option);
        });

    } catch (error) {
        serviceSelect.innerHTML =
            '<option value="">Không thể tải dịch vụ</option>';

        showMessage(error.message, "error");
    }
}

// =========================
// Load doctors
// =========================
async function loadDoctors() {
    try {
        const response = await fetch(`${API_BASE}/doctors`);

        if (!response.ok) {
            throw new Error("Không thể tải danh sách bác sĩ");
        }

        doctors = await response.json();

        doctorSelect.innerHTML =
            '<option value="">-- Chọn dịch vụ trước --</option>';

    } catch (error) {
        doctorSelect.innerHTML =
            '<option value="">Không thể tải bác sĩ</option>';

        showMessage(error.message, "error");
    }
}

function filterDoctorsByService() {
    const serviceId = serviceSelect.value;

    selectedSlot = null;

    slotsContainer.innerHTML =
        '<p class="muted">Vui lòng chọn bác sĩ và ngày khám.</p>';

    doctorSelect.innerHTML =
        '<option value="">-- Chọn bác sĩ --</option>';

    if (!serviceId) {
        doctorSelect.innerHTML =
            '<option value="">-- Chọn dịch vụ trước --</option>';
        return;
    }

    const filteredDoctors = doctors.filter(
        doctor => (doctor.service_ids || []).some(
            id => String(id) === String(serviceId)
        )
    );

    if (filteredDoctors.length === 0) {
        doctorSelect.innerHTML =
            '<option value="">Không có bác sĩ phù hợp</option>';
        return;
    }

    filteredDoctors.forEach(doctor => {
        const option = document.createElement("option");

        option.value = doctor.id;
        option.textContent =
            `${doctor.full_name} - ${doctor.specialty_name}`;

        doctorSelect.appendChild(option);
    });
}

// =========================
// Load slots
// =========================
async function loadSlots() {
    const doctorId = doctorSelect.value;
    const date = dateInput.value;

    selectedSlot = null;

    if (!doctorId || !date) {
        slotsContainer.innerHTML =
            '<p class="muted">Vui lòng chọn bác sĩ và ngày khám.</p>';
        return;
    }
    if (date < dateInput.min) {
        slotsContainer.innerHTML =
            '<p class="muted">Ngày khám đã qua. Vui lòng chọn hôm nay hoặc một ngày tiếp theo.</p>';
        return;
    }

    slotsContainer.innerHTML =
        '<p class="muted">Đang tải khung giờ...</p>';

    try {
        const response = await fetch(
            `${API_BASE}/doctors/${doctorId}/slots?date=${date}`
        );

        if (!response.ok) {
            throw new Error("Không thể tải khung giờ");
        }

        const allSlots = await response.json();

// Ẩn cả các giờ đã qua trong ngày hôm nay.
	const slots = allSlots.filter(
            slot => isFutureSlot(date, slot.start_time)
        );

        if (slots.length === 0) {
            slotsContainer.innerHTML =
                '<p class="muted">Không còn khung giờ phù hợp.</p>';
            return;
        }

        slotsContainer.innerHTML = "";

        slots.forEach(slot => {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "slot";

            button.textContent =
                `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}`;

            button.addEventListener("click", () => {
	         if (!isFutureSlot(date, slot.start_time)) {
    showMessage(
        "Khung giờ đã qua. Vui lòng chọn giờ khác.",
        "error"
    );

    void loadSlots();
    return;
}
                document
                    .querySelectorAll(".slot")
                    .forEach(item => item.classList.remove("selected"));

                button.classList.add("selected");

                selectedSlot = slot;
            });

            slotsContainer.appendChild(button);
        });

    } catch (error) {
        slotsContainer.innerHTML =
            '<p class="muted">Không thể tải khung giờ.</p>';

        showMessage(error.message, "error");
    }
}

// =========================
// Booking
// =========================
async function createAppointment() {
    clearBookingResult();
    const serviceId = serviceSelect.value;
    const doctorId = doctorSelect.value;
    const patientName =
        document.getElementById("patient-name").value.trim();
    const patientPhone =
        document.getElementById("patient-phone").value.trim();
    const patientEmail =
        document.getElementById("patient-email").value.trim();
    const reason =
        document.getElementById("reason").value.trim();

    if (!serviceId || !doctorId) {
        showMessage("Vui lòng chọn dịch vụ và bác sĩ.", "error");
        return;
    }

    if (!selectedSlot) {
        showMessage("Vui lòng chọn khung giờ.", "error");
        return;
    }

    if (!patientName || !patientPhone || !patientEmail) {
        showMessage("Vui lòng nhập đầy đủ thông tin khách hàng.", "error");
        return;
    }

    if (!isFutureSlot(dateInput.value, selectedSlot.start_time)) {
        showMessage("Khung giờ đã qua. Vui lòng chọn giờ khác.", "error");
        await loadSlots();
        return;
    }

    // Giữ thông tin của chính lượt đặt này trong khi chờ API.
    const bookedSlot = { ...selectedSlot };
    const bookedDate = dateInput.value;
    const bookedService = services.find(
        item => String(item.id) === String(serviceId)
    );
    const bookedDoctor = doctors.find(
        item => String(item.id) === String(doctorId)
    );

    bookingButton.disabled = true;
    bookingButton.textContent = "Đang xử lý...";

    try {
    // Bước 1: tìm hoặc tạo bệnh nhân
    const patientResponse = await fetch(`${API_BASE}/patients`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            full_name: patientName,
            email: patientEmail,
            phone: patientPhone
        })
    });

    const patientData = await patientResponse.json();

    if (!patientResponse.ok) {
        throw new Error(
            patientData.error || "Không thể tạo thông tin bệnh nhân"
        );
    }

    const patientId = Number(patientData.patient_id);

    if (!patientId) {
        throw new Error("Không lấy được patient_id");
    }

    // Bước 2: tạo lịch hẹn với đúng patient_id
    const response = await fetch(`${API_BASE}/appointments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            patient_id: patientId,
            doctor_id: Number(doctorId),
            service_id: Number(serviceId),
            slot_id: Number(bookedSlot.id),
            reason: reason || "Đặt lịch khám"
        })
    });

    const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || "Đặt lịch thất bại");
        }

        showMessage("Đặt lịch thành công!", "success");

        confirmation.classList.remove("hidden");

        confirmationContent.replaceChildren();
        addConfirmationLine("Mã lịch hẹn", data.appointment.id);
        addConfirmationLine("Trạng thái", "Chờ phòng khám xác nhận");
        addConfirmationLine("Khách hàng", patientName);
        addConfirmationLine("Số điện thoại", patientPhone);
        addConfirmationLine("Email", patientEmail);
        addConfirmationLine("Dịch vụ", bookedService?.name || serviceId);
        addConfirmationLine("Bác sĩ", bookedDoctor?.full_name || doctorId);
        addConfirmationLine("Ngày khám", bookedDate.split("-").reverse().join("/"));
        addConfirmationLine(
            "Khung giờ",
            bookedSlot.start_time.slice(0, 5) + " - " +
            bookedSlot.end_time.slice(0, 5)
        );

        await loadSlots();

    } catch (error) {
        showMessage(error.message, "error");
    } finally {
        bookingButton.disabled = false;
        bookingButton.textContent = "Xác nhận đặt lịch";
    }
}

// =========================
// Message
// =========================
function showMessage(text, type) {
    message.textContent = text;
    message.className = `message ${type}`;
}

// =========================
// Events
// =========================
serviceSelect.addEventListener("change", filterDoctorsByService);
doctorSelect.addEventListener("change", loadSlots);
dateInput.addEventListener("change", loadSlots);
bookingButton.addEventListener("click", createAppointment);

[serviceSelect, doctorSelect, dateInput].forEach(element => {
    element.addEventListener("change", clearBookingResult);
});

["patient-name", "patient-phone", "patient-email", "reason"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", clearBookingResult);
});

// Xóa kết quả cũ khi bấm quay lại đặt lịch.
confirmation.addEventListener("click", event => {
    if (event.target.closest("a, button")) clearBookingResult();
});


// =========================
// Initial load
// =========================
loadServices();
loadDoctors();

