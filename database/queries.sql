-- ============================================================
--  MedTrack | database/queries.sql
--  Advanced SQL showcase — labeled by concept
--  Each query demonstrates a specific SQL feature
-- ============================================================


-- ════════════════════════════════════════
-- 1. NATURAL JOIN
--    Prescription details with medicine names
-- ════════════════════════════════════════
SELECT
  pr.prescription_id,
  p.full_name      AS patient,
  m.generic_name   AS medicine,
  pm.dosage,
  pm.duration_days,
  pr.status
FROM prescription pr
JOIN appointment a        ON a.appointment_id  = pr.appointment_id
JOIN patient p            ON p.patient_id      = a.patient_id
JOIN prescriptionmedicine pm ON pm.prescription_id = pr.prescription_id
JOIN medicine m           ON m.medicine_id     = pm.medicine_id
ORDER BY pr.created_at DESC;


-- ════════════════════════════════════════
-- 2. LEFT OUTER JOIN
--    Patients WITHOUT any appointments
-- ════════════════════════════════════════
SELECT
  p.patient_id,
  p.full_name,
  p.phone
FROM patient p
LEFT JOIN appointment a ON a.patient_id = p.patient_id
WHERE a.appointment_id IS NULL;


-- ════════════════════════════════════════
-- 3. NESTED SUBQUERY
--    Doctors who prescribed medicines with severe interactions
-- ════════════════════════════════════════
SELECT DISTINCT
  d.full_name      AS doctor,
  d.specialization
FROM doctor d
JOIN appointment a   ON a.doctor_id       = d.doctor_id
JOIN prescription pr ON pr.appointment_id = a.appointment_id
WHERE pr.prescription_id IN (
  SELECT pm1.prescription_id
  FROM prescriptionmedicine pm1
  JOIN prescriptionmedicine pm2
    ON pm1.prescription_id = pm2.prescription_id
   AND pm1.medicine_id    != pm2.medicine_id
  JOIN druginteraction di
    ON (di.medicine1_id = pm1.medicine_id AND di.medicine2_id = pm2.medicine_id)
    OR (di.medicine1_id = pm2.medicine_id AND di.medicine2_id = pm1.medicine_id)
  WHERE di.severity = 'severe'
);


-- ════════════════════════════════════════
-- 4. EXISTS
--    Patients who have undergone at least one medical test
-- ════════════════════════════════════════
SELECT
  p.full_name,
  p.phone
FROM patient p
WHERE EXISTS (
  SELECT 1
  FROM medicaltest mt
  WHERE mt.patient_id = p.patient_id
);


-- ════════════════════════════════════════
-- 5. NOT EXISTS
--    Patients who never missed a single dose
-- ════════════════════════════════════════
SELECT
  p.full_name,
  p.phone,
  calculate_adherence(p.patient_id) AS adherence_pct
FROM patient p
WHERE NOT EXISTS (
  SELECT 1
  FROM doselog dl
  WHERE dl.patient_id = p.patient_id
    AND dl.status     = 'missed'
);


-- ════════════════════════════════════════
-- 6. ALL
--    Patients whose dose count exceeds ALL other patients
-- ════════════════════════════════════════
SELECT
  p.full_name,
  COUNT(dl.log_id) AS total_doses
FROM patient p
JOIN doselog dl ON dl.patient_id = p.patient_id
GROUP BY p.patient_id, p.full_name
HAVING COUNT(dl.log_id) >= ALL (
  SELECT COUNT(log_id)
  FROM doselog
  GROUP BY patient_id
);


-- ════════════════════════════════════════
-- 7. ANY / SOME
--    Medicines prescribed in any active prescription
-- ════════════════════════════════════════
SELECT
  generic_name,
  brand_name,
  dosage_type
FROM medicine
WHERE medicine_id = ANY (
  SELECT medicine_id
  FROM prescriptionmedicine
  WHERE prescription_id IN (
    SELECT prescription_id
    FROM prescription
    WHERE status = 'active'
  )
);


-- ════════════════════════════════════════
-- 8. WITH CLAUSE (CTE)
--    Recovery vs Adherence correlation report
-- ════════════════════════════════════════
WITH adherence_cte AS (
  SELECT
    patient_id,
    ROUND(
      COUNT(CASE WHEN status = 'taken' THEN 1 END) * 100.0 /
      NULLIF(COUNT(CASE WHEN status != 'pending' THEN 1 END), 0), 1
    ) AS adherence_pct
  FROM doselog
  GROUP BY patient_id
),
recovery_cte AS (
  SELECT
    patient_id,
    ROUND(AVG(recovery_score), 1) AS avg_recovery,
    ROUND(AVG(symptom_score),  1) AS avg_symptoms
  FROM recoverylog
  GROUP BY patient_id
)
SELECT
  p.full_name,
  a.adherence_pct,
  r.avg_recovery,
  r.avg_symptoms
FROM patient p
JOIN adherence_cte a ON a.patient_id = p.patient_id
JOIN recovery_cte  r ON r.patient_id = p.patient_id
ORDER BY a.adherence_pct DESC;


-- ════════════════════════════════════════
-- 9. WINDOW FUNCTION — RANK
--    Rank medicines by missed count
-- ════════════════════════════════════════
SELECT
  m.generic_name,
  m.brand_name,
  COUNT(*)                                   AS missed_count,
  RANK()    OVER (ORDER BY COUNT(*) DESC)    AS rank,
  DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) AS dense_rank
FROM doselog dl
JOIN medicationschedule ms ON ms.schedule_id = dl.schedule_id
JOIN medicine m             ON m.medicine_id  = ms.medicine_id
WHERE dl.status = 'missed'
GROUP BY m.generic_name, m.brand_name;


-- ════════════════════════════════════════
-- 10. WINDOW FUNCTION — ROLLING AVERAGE
--     7-day rolling adherence per patient
-- ════════════════════════════════════════
SELECT
  p.full_name,
  dl.scheduled_at::DATE                            AS log_date,
  ROUND(
    AVG(CASE WHEN dl.status = 'taken' THEN 100 ELSE 0 END)
    OVER (
      PARTITION BY dl.patient_id
      ORDER BY dl.scheduled_at::DATE
      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ), 1
  )                                                AS rolling_7day_pct
FROM doselog dl
JOIN patient p ON p.patient_id = dl.patient_id
WHERE dl.status != 'pending'
ORDER BY dl.patient_id, log_date;


-- ════════════════════════════════════════
-- 11. WINDOW FUNCTION — ROW_NUMBER + LAG
--     Recovery trend: compare today vs yesterday
-- ════════════════════════════════════════
SELECT
  p.full_name,
  rl.log_date,
  rl.recovery_score,
  LAG(rl.recovery_score) OVER (
    PARTITION BY rl.patient_id
    ORDER BY rl.log_date
  )                                AS prev_day_score,
  rl.recovery_score - LAG(rl.recovery_score) OVER (
    PARTITION BY rl.patient_id
    ORDER BY rl.log_date
  )                                AS daily_change,
  ROW_NUMBER() OVER (
    PARTITION BY rl.patient_id
    ORDER BY rl.log_date
  )                                AS day_number
FROM recoverylog rl
JOIN patient p ON p.patient_id = rl.patient_id
ORDER BY rl.patient_id, rl.log_date;


-- ════════════════════════════════════════
-- 12. AGGREGATE FUNCTIONS
--     Most prescribed medicines with stats
-- ════════════════════════════════════════
SELECT
  m.generic_name,
  m.brand_name,
  COUNT(*)                             AS times_prescribed,
  COUNT(DISTINCT pm.prescription_id)   AS unique_prescriptions,
  ROUND(AVG(pm.duration_days), 1)      AS avg_duration_days,
  MAX(pm.duration_days)                AS max_duration,
  MIN(pm.duration_days)                AS min_duration
FROM prescriptionmedicine pm
JOIN medicine m ON m.medicine_id = pm.medicine_id
GROUP BY m.generic_name, m.brand_name
ORDER BY times_prescribed DESC;


-- ════════════════════════════════════════
-- 13. SET OPERATION — UNION
--     All people (patients + doctors) in system
-- ════════════════════════════════════════
SELECT full_name, phone, 'Patient' AS role FROM patient
UNION
SELECT full_name, phone, 'Doctor'  AS role FROM doctor
ORDER BY role, full_name;


-- ════════════════════════════════════════
-- 14. SET OPERATION — INTERSECT
--     Medicines that are both prescribed AND have side effects reported
-- ════════════════════════════════════════
SELECT medicine_id FROM prescriptionmedicine
INTERSECT
SELECT medicine_id FROM sideeffectreport;


-- ════════════════════════════════════════
-- 15. SET OPERATION — EXCEPT
--     Medicines never prescribed to anyone
-- ════════════════════════════════════════
SELECT medicine_id, generic_name, brand_name
FROM medicine
WHERE medicine_id NOT IN (
  SELECT DISTINCT medicine_id FROM prescriptionmedicine
);


-- ════════════════════════════════════════
-- 16. CASE EXPRESSION
--     Patient risk classification with color code
-- ════════════════════════════════════════
SELECT
  p.full_name,
  calculate_adherence(p.patient_id) AS adherence_pct,
  CASE
    WHEN calculate_adherence(p.patient_id) >= 80 THEN 'Low Risk 🟢'
    WHEN calculate_adherence(p.patient_id) >= 60 THEN 'Medium Risk 🟡'
    ELSE                                               'High Risk 🔴'
  END AS risk_level,
  CASE
    WHEN calculate_adherence(p.patient_id) >= 80 THEN 'green'
    WHEN calculate_adherence(p.patient_id) >= 60 THEN 'yellow'
    ELSE                                               'red'
  END AS color_code
FROM patient p
ORDER BY adherence_pct DESC;


-- ════════════════════════════════════════
-- 17. GROUP BY + HAVING
--     Patients with more than 3 missed doses
-- ════════════════════════════════════════
SELECT
  p.full_name,
  COUNT(dl.log_id) AS missed_doses
FROM patient p
JOIN doselog dl ON dl.patient_id = p.patient_id
WHERE dl.status = 'missed'
GROUP BY p.patient_id, p.full_name
HAVING COUNT(dl.log_id) > 3
ORDER BY missed_doses DESC;


-- ════════════════════════════════════════
-- 18. CORRELATED SUBQUERY
--     Patients whose adherence is above the overall average
-- ════════════════════════════════════════
SELECT
  p.full_name,
  calculate_adherence(p.patient_id) AS adherence_pct
FROM patient p
WHERE calculate_adherence(p.patient_id) > (
  SELECT AVG(calculate_adherence(p2.patient_id))
  FROM patient p2
)
ORDER BY adherence_pct DESC;


-- ════════════════════════════════════════
-- 19. VIEW USAGE
--     Query the views we created
-- ════════════════════════════════════════
-- Patient adherence summary
SELECT * FROM patientadherencesummary ORDER BY adherence_pct ASC;

-- High risk patients only
SELECT * FROM highriskpatients;

-- Safe prescriptions (no severe drug interactions)
SELECT * FROM safeprescriptions;

-- Low pharmacy stock
SELECT * FROM pharmacylowstock;

-- Most missed medicines
SELECT * FROM mostmissedmedicines LIMIT 5;


-- ════════════════════════════════════════
-- 20. STORED PROCEDURE USAGE
--     Call the procedures we created
-- ════════════════════════════════════════
-- Get adherence for patient 1
SELECT calculate_adherence(1) AS adherence_pct;

-- Get risk level for patient 3
SELECT get_patient_risk(3) AS risk;

-- Check interaction between medicine 1 and 4
SELECT check_drug_interaction(1, 4);

-- Generate alerts for all patients
SELECT generate_all_alerts();