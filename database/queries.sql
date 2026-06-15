-- ============================================================
--  MedTrack | queries.sql
--  Sample queries demonstrating the SQL features required for
--  the lab report. Run AFTER schema.sql and seed.sql.
-- ============================================================


-- ============================================================
-- Q1. JOIN ... ON  — appointment list with patient & doctor names
-- ============================================================
SELECT p.full_name AS patient,
       d.full_name AS doctor,
       a.appointment_date,
       a.symptoms,
       a.status
FROM Patient p
JOIN Appointment a ON p.patient_id = a.patient_id
JOIN Doctor d      ON a.doctor_id  = d.doctor_id
ORDER BY a.appointment_date;


-- ============================================================
-- Q2. JOIN ... USING  — medicines and the prescriptions that use them
-- ============================================================
SELECT m.generic_name, m.brand_name, pm.dosage, pm.duration_days
FROM Medicine m
JOIN PrescriptionMedicine pm USING (medicine_id)
ORDER BY m.generic_name;


-- ============================================================
-- Q3. NATURAL JOIN  — patients and their recorded allergies
-- ============================================================
SELECT full_name, allergy_name, noted_date
FROM Patient
NATURAL JOIN PatientAllergy
NATURAL JOIN Allergy
ORDER BY full_name;


-- ============================================================
-- Q4. CROSS JOIN + NOT EXISTS  — medicine/allergy pairs that have
--     NOT yet been reviewed for a conflict (cartesian product
--     of Medicine x Allergy, minus the ones already documented)
-- ============================================================
SELECT m.generic_name, al.allergy_name
FROM Medicine m
CROSS JOIN Allergy al
WHERE NOT EXISTS (
    SELECT 1
    FROM MedicineAllergyConflict mac
    WHERE mac.medicine_id = m.medicine_id
      AND mac.allergy_id  = al.allergy_id
)
ORDER BY m.generic_name, al.allergy_name;


-- ============================================================
-- Q5. LEFT OUTER JOIN  — every patient, with adherence alerts if any
-- ============================================================
SELECT p.full_name, aa.alert_type, aa.severity, aa.resolved
FROM Patient p
LEFT JOIN AdherenceAlert aa ON p.patient_id = aa.patient_id
ORDER BY p.full_name;


-- ============================================================
-- Q6. FULL OUTER JOIN  — medicines matched against any side-effect
--     reports filed against them (medicines with none still appear)
-- ============================================================
SELECT m.generic_name, ser.effect_name, ser.severity
FROM Medicine m
FULL OUTER JOIN SideEffectReport ser ON m.medicine_id = ser.medicine_id
ORDER BY m.generic_name;


-- ============================================================
-- Q7. EXISTS  — patients who currently have an unresolved alert
-- ============================================================
SELECT full_name, phone
FROM Patient p
WHERE EXISTS (
    SELECT 1 FROM AdherenceAlert aa
    WHERE aa.patient_id = p.patient_id AND aa.resolved = FALSE
);


-- ============================================================
-- Q8. NOT EXISTS  — patients with no recorded allergy at all
-- ============================================================
SELECT full_name
FROM Patient p
WHERE NOT EXISTS (
    SELECT 1 FROM PatientAllergy pa WHERE pa.patient_id = p.patient_id
);


-- ============================================================
-- Q9. ANY  — medicines whose stock is less than at least one
--     (ANY) of Square Pharma's medicine stock levels
-- ============================================================
SELECT m.generic_name, m.manufacturer, pi.stock
FROM Medicine m
JOIN PharmacyInventory pi ON m.medicine_id = pi.medicine_id
WHERE pi.stock < ANY (
    SELECT pi2.stock
    FROM PharmacyInventory pi2
    JOIN Medicine m2 ON pi2.medicine_id = m2.medicine_id
    WHERE m2.manufacturer = 'Square Pharma'
)
ORDER BY pi.stock;


-- ============================================================
-- Q10. ALL  — medicines with stock greater than ALL of Sanofi's
--      medicine stock levels
-- ============================================================
SELECT m.generic_name, m.manufacturer, pi.stock
FROM Medicine m
JOIN PharmacyInventory pi ON m.medicine_id = pi.medicine_id
WHERE pi.stock > ALL (
    SELECT pi2.stock
    FROM PharmacyInventory pi2
    JOIN Medicine m2 ON pi2.medicine_id = m2.medicine_id
    WHERE m2.manufacturer = 'Sanofi'
)
ORDER BY pi.stock;


-- ============================================================
-- Q11. SOME  — patients who logged at least one (SOME) day with
--      a recovery score of 8 or higher
-- ============================================================
SELECT DISTINCT p.full_name
FROM Patient p
JOIN RecoveryLog rl ON p.patient_id = rl.patient_id
WHERE rl.recovery_score = SOME (
    SELECT recovery_score FROM RecoveryLog WHERE recovery_score >= 8
)
ORDER BY p.full_name;


-- ============================================================
-- Q12. UNIQUE predicate  — medicines that are always prescribed
--      with the same (single distinct) dosage value.
--      NOTE: the SQL-standard UNIQUE predicate below is NOT
--      implemented by PostgreSQL/Oracle, so it is shown for
--      reference only; the portable equivalent is used instead.
-- ============================================================
-- Standard SQL (not executable on PostgreSQL/Oracle):
-- SELECT m.generic_name
-- FROM Medicine m
-- WHERE UNIQUE (SELECT pm.dosage FROM PrescriptionMedicine pm
--               WHERE pm.medicine_id = m.medicine_id);

-- Portable equivalent:
SELECT m.generic_name
FROM Medicine m
JOIN PrescriptionMedicine pm ON m.medicine_id = pm.medicine_id
GROUP BY m.medicine_id, m.generic_name
HAVING COUNT(*) = COUNT(DISTINCT pm.dosage);


-- ============================================================
-- Q13. Subquery in FROM clause (derived table)  — per-patient
--      adherence percentage
-- ============================================================
SELECT p.full_name,
       adh.total_doses,
       adh.taken_doses,
       ROUND(100.0 * adh.taken_doses / adh.total_doses, 2) AS adherence_pct
FROM Patient p
JOIN (
    SELECT patient_id,
           COUNT(*) AS total_doses,
           COUNT(*) FILTER (WHERE status = 'taken') AS taken_doses
    FROM DoseLog
    GROUP BY patient_id
) adh ON adh.patient_id = p.patient_id
ORDER BY adherence_pct;


-- ============================================================
-- Q14. Scalar subquery in SELECT clause  — each patient with
--      their total number of prescriptions
-- ============================================================
SELECT p.full_name,
       (SELECT COUNT(*)
        FROM Appointment a
        JOIN Prescription pr ON pr.appointment_id = a.appointment_id
        WHERE a.patient_id = p.patient_id) AS prescription_count
FROM Patient p
ORDER BY prescription_count DESC, p.full_name;


-- ============================================================
-- Q15. Subquery in WHERE clause  — patients with a chronic disease
-- ============================================================
SELECT full_name
FROM Patient
WHERE patient_id IN (
    SELECT patient_id FROM PatientDiseaseHistory WHERE status = 'chronic'
)
ORDER BY full_name;


-- ============================================================
-- Q16. GROUP BY + HAVING  — patients who have missed more than
--      one dose
-- ============================================================
SELECT p.full_name, COUNT(*) AS missed_count
FROM DoseLog dl
JOIN Patient p ON p.patient_id = dl.patient_id
WHERE dl.status = 'missed'
GROUP BY p.patient_id, p.full_name
HAVING COUNT(*) > 1
ORDER BY missed_count DESC;


-- ============================================================
-- Q17. ORDER BY (multiple keys)  — medicines by manufacturer
--      then generic name
-- ============================================================
SELECT generic_name, manufacturer, dosage_type
FROM Medicine
ORDER BY manufacturer, generic_name;


-- ============================================================
-- Q18. WITH clause (CTE)  — patients whose dose adherence is
--      below 70%
-- ============================================================
WITH adherence AS (
    SELECT patient_id,
           COUNT(*) AS total_doses,
           COUNT(*) FILTER (WHERE status = 'taken') AS taken_doses
    FROM DoseLog
    GROUP BY patient_id
)
SELECT p.full_name,
       ROUND(100.0 * a.taken_doses / a.total_doses, 2) AS adherence_pct
FROM Patient p
JOIN adherence a ON a.patient_id = p.patient_id
WHERE (100.0 * a.taken_doses / a.total_doses) < 70
ORDER BY adherence_pct;


-- ============================================================
-- Q19. String manipulation  — UPPER, LOWER, concatenation,
--      SUBSTRING, LIKE
-- ============================================================
SELECT UPPER(full_name)                    AS name_upper,
       LOWER(blood_group)                  AS blood_group_lower,
       full_name || ' (' || blood_group || ')' AS display_name,
       SUBSTRING(phone FROM 1 FOR 5)       AS area_code
FROM Patient
WHERE full_name LIKE '%Khatun%'
ORDER BY full_name;


-- ============================================================
-- Q20. Set operations  — UNION / INTERSECT / EXCEPT
-- ============================================================

-- (a) Patients who either have a recorded allergy OR a chronic disease
SELECT patient_id FROM PatientAllergy
UNION
SELECT patient_id FROM PatientDiseaseHistory WHERE status = 'chronic';

-- (b) Patients who have BOTH a recorded allergy AND a chronic disease
SELECT patient_id FROM PatientAllergy
INTERSECT
SELECT patient_id FROM PatientDiseaseHistory WHERE status = 'chronic';

-- (c) Patients with a chronic disease but NO recorded allergy
SELECT patient_id FROM PatientDiseaseHistory WHERE status = 'chronic'
EXCEPT
SELECT patient_id FROM PatientAllergy;


-- ============================================================
-- Q21. Aggregate functions  — COUNT, AVG, MIN, MAX over patients
-- ============================================================
SELECT COUNT(*)                                   AS total_patients,
       ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob))), 1) AS avg_age,
       MIN(dob)                                   AS earliest_dob,
       MAX(dob)                                   AS latest_dob
FROM Patient;


-- ============================================================
-- Q22. Other built-in functions  — date arithmetic, COALESCE, CASE
-- ============================================================
SELECT full_name,
       EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob)) AS age,
       COALESCE(blood_group, 'Unknown')          AS blood_group,
       CASE
           WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob)) >= 60 THEN 'Senior'
           WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob)) >= 18 THEN 'Adult'
           ELSE 'Minor'
       END                                       AS age_group
FROM Patient
ORDER BY age DESC;


-- ============================================================
-- Q23. UPDATE  — resolve an alert once adherence has improved,
--      and record a pharmacy dispensing transaction
-- ============================================================
UPDATE AdherenceAlert
SET resolved = TRUE
WHERE patient_id = 5 AND alert_type = 'low_adherence';

UPDATE PharmacyInventory
SET stock = stock - 10,
    last_updated = NOW()
WHERE medicine_id = 1;


-- ============================================================
-- Q24. DELETE  — clean up resolved low-severity alerts and very
--      old low-severity side-effect reports
-- ============================================================
DELETE FROM AdherenceAlert
WHERE resolved = TRUE AND severity = 'low';

DELETE FROM SideEffectReport
WHERE severity = 'low' AND reported_at < NOW() - INTERVAL '1 year';
