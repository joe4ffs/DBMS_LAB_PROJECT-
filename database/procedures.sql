-- ============================================================
--  MedTrack | database/procedures.sql
--  Stored functions — call with SELECT fn_name(args)
--  Run after schema.sql
-- ============================================================


-- ── 1. Calculate adherence % for a patient
--   Usage: SELECT calculate_adherence(1);

CREATE OR REPLACE FUNCTION calculate_adherence(p_id INT)
RETURNS NUMERIC AS $$
DECLARE
  taken_count INT;
  total_count INT;
BEGIN
  SELECT
    COUNT(CASE WHEN status = 'taken' THEN 1 END),
    COUNT(CASE WHEN status != 'pending' THEN 1 END)
  INTO taken_count, total_count
  FROM doselog
  WHERE patient_id = p_id;

  IF total_count = 0 THEN RETURN 0; END IF;
  RETURN ROUND(taken_count * 100.0 / total_count, 1);
END;
$$ LANGUAGE plpgsql;


-- ── 2. Log a dose as taken
--   Usage: SELECT log_dose_taken(5);  -- log_id = 5

CREATE OR REPLACE FUNCTION log_dose_taken(p_log_id INT)
RETURNS TEXT AS $$
BEGIN
  UPDATE doselog
  SET status   = 'taken',
      taken_at = NOW()
  WHERE log_id = p_log_id
    AND status IN ('pending', 'missed');

  IF NOT FOUND THEN
    RETURN 'Dose not found or already taken';
  END IF;

  RETURN 'Dose marked as taken successfully';
END;
$$ LANGUAGE plpgsql;


-- ── 3. Get patient risk level
--   Returns: 'High Risk' / 'Medium Risk' / 'Low Risk'
--   Usage: SELECT get_patient_risk(3);

CREATE OR REPLACE FUNCTION get_patient_risk(p_id INT)
RETURNS TEXT AS $$
DECLARE
  missed_count INT;
  adherence    NUMERIC;
BEGIN
  SELECT
    COUNT(CASE WHEN status = 'missed' THEN 1 END)
  INTO missed_count
  FROM doselog
  WHERE patient_id = p_id;

  adherence := calculate_adherence(p_id);

  IF missed_count >= 5 OR adherence < 60 THEN
    RETURN 'High Risk';
  ELSIF missed_count >= 2 OR adherence < 80 THEN
    RETURN 'Medium Risk';
  ELSE
    RETURN 'Low Risk';
  END IF;
END;
$$ LANGUAGE plpgsql;


-- ── 4. Check drug interaction between two medicines
--   Returns severity or 'No interaction found'
--   Usage: SELECT check_drug_interaction(1, 4);

CREATE OR REPLACE FUNCTION check_drug_interaction(med1 INT, med2 INT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT severity || ': ' || warning_message
  INTO result
  FROM druginteraction
  WHERE (medicine1_id = med1 AND medicine2_id = med2)
     OR (medicine1_id = med2 AND medicine2_id = med1);

  IF result IS NULL THEN
    RETURN 'No known interaction found';
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;


-- ── 5. Generate alerts for all patients with low adherence
--   Call manually to batch-check all patients
--   Usage: SELECT generate_all_alerts();

CREATE OR REPLACE FUNCTION generate_all_alerts()
RETURNS TEXT AS $$
DECLARE
  p RECORD;
  alerts_created INT := 0;
  adherence NUMERIC;
BEGIN
  FOR p IN SELECT patient_id FROM patient LOOP
    adherence := calculate_adherence(p.patient_id);

    IF adherence < 60 THEN
      IF NOT EXISTS (
        SELECT 1 FROM adherencealert
        WHERE patient_id = p.patient_id
          AND alert_type = 'low_adherence'
          AND resolved   = FALSE
      ) THEN
        INSERT INTO adherencealert (patient_id, alert_type, message, severity)
        VALUES (
          p.patient_id,
          'low_adherence',
          'Adherence below 60%: ' || adherence || '%',
          'critical'
        );
        alerts_created := alerts_created + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN alerts_created || ' new alerts created';
END;
$$ LANGUAGE plpgsql;