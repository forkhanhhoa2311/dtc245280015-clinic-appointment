CREATE OR REPLACE FUNCTION clinic_future_appointment() RETURNS trigger AS $$
DECLARE s TIMESTAMPTZ;
BEGIN
  SELECT (slot_date + start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh' INTO s
  FROM appointment_slots WHERE id = NEW.slot_id;
  IF s IS NULL OR s <= now() THEN
    RAISE EXCEPTION 'Không thể đặt lịch vào thời gian đã qua';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clinic_future_appointment ON appointments;
CREATE TRIGGER clinic_future_appointment
  BEFORE INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION clinic_future_appointment();
