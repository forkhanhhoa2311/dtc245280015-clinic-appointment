BEGIN;

CREATE TABLE IF NOT EXISTS doctor_services (
    doctor_id BIGINT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    service_id BIGINT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    PRIMARY KEY (doctor_id, service_id)
);

-- Gán dịch vụ demo theo chuyên khoa, không phụ thuộc ID.
INSERT INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN specialties sp ON sp.id = d.specialty_id
JOIN (
    VALUES
        ('Nội tổng quát', 'Khám tổng quát'),
        ('Nội tổng quát', 'Tư vấn sức khỏe'),
        ('Tim mạch', 'Khám tim mạch'),
        ('Da liễu', 'Khám da liễu')
) AS mapping(specialty_name, service_name)
    ON mapping.specialty_name = sp.name
JOIN services s ON s.name = mapping.service_name
ON CONFLICT DO NOTHING;

COMMIT;
