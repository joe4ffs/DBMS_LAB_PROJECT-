-- ============================================================
--  MedTrack | database/triggers.sql
--  Auto-run logic inside PostgreSQL — no backend needed
--  Run after schema.sql
-- ============================================================


-- ── TRIGGER 1: Missed Streak Alert
--   Fires after a dose is marked missed.
--   If the last 3 doses for this patient are all missed → create alert.

CREATE OR REPLACE FUNCTION fn_check_missed_streak()
RETURNS TRIGGER AS $$
DECLARE
  recent_missed INT;
BEGIN
  SELECT COUNT(*) INTO recent_missed
  FROM (
    SELECT status
    FROM doselog
    WHERE patient_id = NEW.patient_id
      AND status != 'pending'
    ORDER BY scheduled_at DESC
    LIMIT 3
  ) last3
  WHERE status = 'missed';

  IF recent_missed >= 3 THEN
    -- Only insert if no unresolved streak alert already exists
    IF NOT EXISTS (
      SELECT 1 FROM adherencealert
      WHERE patient_id  = NEW.patient_id
        AND alert_type  = 'missed_streak'
        AND resolved    = FALSE
    ) THEN
      INSERT INTO adherencealert (patient_id, alert_type, message, severity)
      VALUES (
        NEW.patient_id,
        'missed_streak',
        'Patient has missed 3 or more consecutive doses. Immediate follow-up required.',
        'high'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_missed_streak
AFTER INSERT OR UPDATE ON doselog
FOR EACH ROW
WHEN (NEW.status = 'missed')
EXECUTE FUNCTION fn_check_missed_streak();


-- ── TRIGGER 2: Low Adherence Alert
--   Fires after any dose log update.
--   If patient adherence drops below 60% (min 5 doses logged) → create alert.

CREATE OR REPLACE FUNCTION fn_check_low_adherence()
RETURNS TRIGGER AS $$
DECLARE
  total_doses  INT;
  taken_doses  INT;
  adherence    NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COUNT(CASE WHEN status = 'taken' THEN 1 END)
  INTO total_doses, taken_doses
  FROM doselog
  WHERE patient_id = NEW.patient_id
    AND status != 'pending';

  IF total_doses >= 5 THEN
    adherence := ROUND(taken_doses * 100.0 / total_doses, 1);

    IF adherence < 60 THEN
      IF NOT EXISTS (
        SELECT 1 FROM adherencealert
        WHERE patient_id = NEW.patient_id
          AND alert_type = 'low_adherence'
          AND resolved   = FALSE
      ) THEN
        INSERT INTO adherencealert (patient_id, alert_type, message, severity)
        VALUES (
          NEW.patient_id,
          'low_adherence',
          'Patient adherence dropped below 60% (' || adherence || '%). Review prescription.',
          'critical'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_low_adherence
AFTER INSERT OR UPDATE ON doselog
FOR EACH ROW
EXECUTE FUNCTION fn_check_low_adherence();


-- ── TRIGGER 3: Prescription Audit Log
--   Fires after any UPDATE on prescription.
--   Records old and new values in auditlog table.

CREATE OR REPLACE FUNCTION fn_audit_prescription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO auditlog (table_name, operation, record_id, old_value, new_value)
  VALUES (
    'prescription',
    TG_OP,
    NEW.prescription_id,
    row_to_json(OLD)::TEXT,
    row_to_json(NEW)::TEXT
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_audit_prescription
AFTER UPDATE ON prescription
FOR EACH ROW
EXECUTE FUNCTION fn_audit_prescription();


-- ── TRIGGER 4: Auto-update PharmacyInventory last_updated
--   Fires after any stock change in pharmacyinventory.

CREATE OR REPLACE FUNCTION fn_update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_inventory_timestamp
BEFORE UPDATE ON pharmacyinventory
FOR EACH ROW
EXECUTE FUNCTION fn_update_inventory_timestamp();