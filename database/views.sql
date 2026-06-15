-- ============================================================
--  MedTrack | database/views.sql
--  Saved views — query like a table: SELECT * FROM viewname
--  Run after schema.sql
-- ============================================================


-- ── 1. Patient Adherence Summary
--       Shows taken/missed/late counts + adherence % per patient
CREATE OR REPLACE VIEW patientadherencesummary AS
SELECT
  p.patient_id,
  p.full_name,
  p.phone,
  p.blood_group,
  COUNT(dl.log_id)                                                        AS total_doses,
  COUNT(CASE WHEN dl.status = 'taken'  THEN 1 END)                       AS taken,
  COUNT(CASE WHEN dl.status = 'missed' THEN 1 END)                       AS missed,
  COUNT(CASE WHEN dl.status = 'late'   THEN 1 END)                       AS late,
  ROUND(
    COUNT(CASE WHEN dl.status = 'taken' THEN 1 END) * 100.0 /
    NULLIF(COUNT(CASE WHEN dl.status != 'pending' THEN 1 END), 0), 1
  )                                                                        AS adherence_pct
FROM patient p
LEFT JOIN doselog dl ON dl.patient_id = p.patient_id
GROUP BY p.patient_id, p.full_name, p.phone, p.blood_group;


-- ── 2. High Risk Patients  (adherence below 70%)
CREATE OR REPLACE VIEW highriskpatients AS
SELECT *
FROM patientadherencesummary
WHERE adherence_pct < 70
ORDER BY adherence_pct ASC;


-- ── 3. Weekly Recovery Trend
--       Average recovery + symptom score grouped by week per patient
CREATE OR REPLACE VIEW weeklyrecoverytrend AS
SELECT
  p.full_name,
  DATE_TRUNC('week', rl.log_date)   AS week_start,
  ROUND(AVG(rl.recovery_score), 1)  AS avg_recovery,
  ROUND(AVG(rl.symptom_score),  1)  AS avg_symptoms
FROM recoverylog rl
JOIN patient p ON p.patient_id = rl.patient_id
GROUP BY p.full_name, DATE_TRUNC('week', rl.log_date)
ORDER BY week_start DESC;


-- ── 4. Most Missed Medicines
--       Ranks medicines by how often patients skip them
CREATE OR REPLACE VIEW mostmissedmedicines AS
SELECT
  m.generic_name,
  m.brand_name,
  m.dosage_type,
  COUNT(*) AS missed_count,
  RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
FROM doselog dl
JOIN medicationschedule ms ON ms.schedule_id = dl.schedule_id
JOIN medicine m             ON m.medicine_id  = ms.medicine_id
WHERE dl.status = 'missed'
GROUP BY m.generic_name, m.brand_name, m.dosage_type;


-- ── 5. Most Prescribed Medicines
CREATE OR REPLACE VIEW mostprescribedmedicines AS
SELECT
  m.generic_name,
  m.brand_name,
  m.dosage_type,
  COUNT(*) AS prescription_count,
  RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
FROM prescriptionmedicine pm
JOIN medicine m ON m.medicine_id = pm.medicine_id
GROUP BY m.generic_name, m.brand_name, m.dosage_type;


-- ── 6. Safe Prescription View
--       Prescriptions that contain NO severe drug interactions
CREATE OR REPLACE VIEW safeprescriptions AS
SELECT DISTINCT
  pr.prescription_id,
  pr.start_date,
  pr.end_date,
  pr.status,
  pr.notes,
  p.full_name AS patient_name
FROM prescription pr
JOIN appointment a  ON a.appointment_id  = pr.appointment_id
JOIN patient p      ON p.patient_id      = a.patient_id
WHERE pr.prescription_id NOT IN (
  SELECT DISTINCT pm1.prescription_id
  FROM prescriptionmedicine pm1
  JOIN prescriptionmedicine pm2
    ON pm1.prescription_id = pm2.prescription_id
   AND pm1.medicine_id    != pm2.medicine_id
  JOIN druginteraction di
    ON (di.medicine1_id = pm1.medicine_id AND di.medicine2_id = pm2.medicine_id)
    OR (di.medicine1_id = pm2.medicine_id AND di.medicine2_id = pm1.medicine_id)
  WHERE di.severity = 'severe'
);


-- ── 7. Active Unresolved Alerts per Patient
CREATE OR REPLACE VIEW activealerts AS
SELECT
  p.full_name,
  aa.alert_type,
  aa.message,
  aa.severity,
  aa.triggered_at
FROM adherencealert aa
JOIN patient p ON p.patient_id = aa.patient_id
WHERE aa.resolved = FALSE
ORDER BY aa.triggered_at DESC;


-- ── 8. Pharmacy Low Stock (stock < 20 or expiring within 30 days)
CREATE OR REPLACE VIEW pharmacylowstock AS
SELECT
  m.generic_name,
  m.brand_name,
  pi.stock,
  pi.expiry_date,
  CASE
    WHEN pi.stock = 0              THEN 'Out of Stock'
    WHEN pi.stock < 10             THEN 'Critical'
    WHEN pi.stock < 20             THEN 'Low'
    WHEN pi.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Expiring Soon'
    ELSE 'OK'
  END AS stock_status
FROM pharmacyinventory pi
JOIN medicine m ON m.medicine_id = pi.medicine_id
WHERE pi.stock < 20
   OR pi.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY pi.stock ASC, pi.expiry_date ASC;