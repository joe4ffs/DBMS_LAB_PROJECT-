// ============================================================
//  MedTrack | interactions.js
//  Drug interaction checker + allergy conflict checker
// ============================================================

// ── Load medicine dropdowns
async function loadMedicineDropdowns() {
  const data = await api.medicines();

  const opts = `<option value="">Select medicine...</option>` +
    data.map(m => `<option value="${m.medicine_id}">${m.generic_name} (${m.brand_name ?? '—'})</option>`).join('');

  const d1 = document.getElementById('drug1');
  const d2 = document.getElementById('drug2');
  const am = document.getElementById('allergy-medicine');
  if (d1) d1.innerHTML = opts;
  if (d2) d2.innerHTML = opts;
  if (am) am.innerHTML = opts;
}

// ── Load patient dropdown for allergy checker
async function loadAllergyPatientDropdown() {
  const data = await api.patients();
  const sel  = document.getElementById('allergy-patient');
  if (!sel) return;
  sel.innerHTML = `<option value="">Select patient...</option>` +
    data.map(p => `<option value="${p.patient_id}">${p.full_name}</option>`).join('');
}

// ── Check drug interaction
async function checkInteraction() {
  const m1 = parseInt(document.getElementById('drug1')?.value);
  const m2 = parseInt(document.getElementById('drug2')?.value);
  const el = document.getElementById('interaction-result');
  if (!el) return;

  if (!m1 || !m2) {
    el.innerHTML = `<div class="result-warning"><div class="result-title">⚠️ Select both medicines first</div></div>`;
    return;
  }
  if (m1 === m2) {
    el.innerHTML = `<div class="result-warning"><div class="result-title">⚠️ Please select two different medicines</div></div>`;
    return;
  }

  el.innerHTML = `<div style="color:var(--muted);font-size:13px">Checking...</div>`;

  const data = await api.checkInteraction(m1, m2);

  if (!data?.length) {
    el.innerHTML = `
      <div class="result-safe">
        <div class="result-title">✅ No Known Interaction</div>
        <div class="result-msg">These two medicines can be safely prescribed together based on current records.</div>
      </div>`;
    return;
  }

  const i   = data[0];
  const cls = i.severity === 'severe'   ? 'result-danger'  :
              i.severity === 'moderate' ? 'result-warning' : 'result-safe';
  const icon= i.severity === 'severe'   ? '🚨' :
              i.severity === 'moderate' ? '⚠️' : 'ℹ️';

  el.innerHTML = `
    <div class="${cls}">
      <div class="result-title">${icon} ${i.severity.toUpperCase()} Interaction Detected</div>
      <div class="result-msg">${i.warning_message}</div>
    </div>`;
}

// ── Load all known interactions table
async function loadAllInteractions() {
  const data  = await api.interactions();
  const tbody = document.getElementById('interactions-list');
  if (!tbody) return;

  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">No drug interactions recorded yet</td></tr>`;
    return;
  }

  const meds   = await api.medicines();
  const medMap = Object.fromEntries(meds.map(m => [m.medicine_id, m.generic_name]));

  tbody.innerHTML = data.map(i => {
    const badge = i.severity === 'severe'   ? 'badge-red'    :
                  i.severity === 'moderate' ? 'badge-yellow' : 'badge-green';
    return `<tr>
      <td><strong>${medMap[i.medicine1_id] ?? '—'}</strong></td>
      <td><strong>${medMap[i.medicine2_id] ?? '—'}</strong></td>
      <td><span class="badge ${badge}">${i.severity}</span></td>
      <td>${i.warning_message}</td>
    </tr>`;
  }).join('');
}

// ── Check allergy conflict
async function checkAllergyConflict() {
  const pid = parseInt(document.getElementById('allergy-patient')?.value);
  const mid = parseInt(document.getElementById('allergy-medicine')?.value);
  const el  = document.getElementById('allergy-result');
  if (!el) return;

  if (!pid || !mid) {
    el.innerHTML = `<div class="result-warning"><div class="result-title">⚠️ Select both patient and medicine</div></div>`;
    return;
  }

  el.innerHTML = `<div style="color:var(--muted);font-size:13px">Checking...</div>`;

  const conflicts = await api.checkAllergy(pid, mid);

  if (!conflicts?.length) {
    el.innerHTML = `
      <div class="result-safe">
        <div class="result-title">✅ Safe to Prescribe</div>
        <div class="result-msg">No allergy conflicts found between this patient and this medicine.</div>
      </div>`;
    return;
  }

  const c   = conflicts[0];
  const cls = c.severity === 'severe' ? 'result-danger' : 'result-warning';
  el.innerHTML = `
    <div class="${cls}">
      <div class="result-title">🚨 ALLERGY CONFLICT DETECTED</div>
      <div class="result-msg">
        Patient is allergic to <strong>${c.allergy?.allergy_name ?? '—'}</strong>.<br>
        Severity: <strong>${c.severity}</strong> — Reaction: ${c.reaction}
      </div>
    </div>`;
}

// ── Load allergy records table
async function loadAllergyList() {
  const data  = await api.allergies();
  const tbody = document.getElementById('allergy-list');
  if (!tbody) return;

  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty">No allergy records found</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(a => `<tr>
    <td><strong>${a.patient?.full_name ?? '—'}</strong></td>
    <td><span class="badge badge-orange">${a.allergy?.allergy_name ?? '—'}</span></td>
    <td>${a.noted_date ?? '—'}</td>
  </tr>`).join('');
}

// ── Init
loadMedicineDropdowns();
loadAllergyPatientDropdown();
loadAllInteractions();
loadAllergyList();
