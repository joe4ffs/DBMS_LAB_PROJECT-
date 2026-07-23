// ============================================================
//  MedTrack | doses.js  (legacy helper — see patient_portal.js)
// ============================================================

async function loadTodaySchedule(patientId) {
  const data      = await api.portalTodayDoses(patientId);
  const container = document.getElementById('today-doses');
  if (!data?.length) {
    container.innerHTML = '<div class="empty">No doses scheduled for today</div>';
    return;
  }

  container.innerHTML = data.map(d => {
    const med   = d.medicationschedule?.medicine;
    const badge = d.status === 'taken'  ? 'badge-green'  :
                  d.status === 'missed' ? 'badge-red'    :
                  d.status === 'late'   ? 'badge-yellow' : 'badge-blue';
    const btn = (d.status === 'pending' || d.status === 'missed')
      ? `<button class="btn btn-green" onclick="markTaken(${d.log_id})">Mark Taken</button>`
      : `<span class="badge ${badge}">${d.status}</span>`;

    return `<div class="dose-row">
      <div>
        <div class="dose-info">${med?.generic_name ?? '—'} <span style="color:var(--muted)">(${med?.brand_name ?? ''})</span></div>
        <div class="dose-time">${d.medicationschedule?.dose_time ?? ''} · ${med?.dosage_type ?? ''}</div>
      </div>
      ${btn}
    </div>`;
  }).join('');
}

async function markTaken(logId) {
  await api.markDoseTaken(logId);
  const patientId = parseInt(document.getElementById('patient-id').value);
  loadTodaySchedule(patientId);
  loadAdherenceStats(patientId);
}

async function loadAdherenceStats(patientId) {
  const s = await api.portalAdherence(patientId);
  document.getElementById('adh-pct').textContent    = s.pct + '%';
  document.getElementById('adh-taken').textContent  = s.taken;
  document.getElementById('adh-missed').textContent = s.missed;
  document.getElementById('adh-late').textContent   = s.late;

  const fill = document.getElementById('adh-fill');
  const color = s.pct >= 80 ? '#8b7fd6' : s.pct >= 60 ? '#f59e0b' : '#ef4444';
  if (fill) { fill.style.width = s.pct + '%'; fill.style.background = color; }
}
