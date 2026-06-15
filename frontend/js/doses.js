// ============================================================
//  MedTrack | frontend/js/doses.js
//  Dose tracking logic for patient portal
// ============================================================

async function loadTodaySchedule(patientId) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await db
    .from('doselog')
    .select('*, medicationschedule(dose_time, medicine(generic_name, brand_name, dosage_type))')
    .eq('patient_id', patientId)
    .gte('scheduled_at', today + 'T00:00:00')
    .lte('scheduled_at', today + 'T23:59:59')
    .order('scheduled_at');

  if (error) { console.error(error); return; }

  const container = document.getElementById('today-doses');
  if (!data || !data.length) {
    container.innerHTML = '<div class="empty">No doses scheduled for today</div>';
    return;
  }

  container.innerHTML = data.map(d => {
    const med    = d.medicationschedule?.medicine;
    const badge  = d.status === 'taken'  ? 'badge-green'  :
                   d.status === 'missed' ? 'badge-red'    :
                   d.status === 'late'   ? 'badge-yellow' : 'badge-blue';
    const btn = d.status === 'pending' || d.status === 'missed'
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
  const { error } = await db
    .from('doselog')
    .update({ status: 'taken', taken_at: new Date().toISOString() })
    .eq('log_id', logId);

  if (error) { alert('Error updating dose'); return; }
  const patientId = parseInt(document.getElementById('patient-id').value);
  loadTodaySchedule(patientId);
  loadAdherenceStats(patientId);
}

async function loadAdherenceStats(patientId) {
  const { data } = await db
    .from('doselog')
    .select('status')
    .eq('patient_id', patientId)
    .neq('status', 'pending');

  if (!data) return;
  const total  = data.length;
  const taken  = data.filter(d => d.status === 'taken').length;
  const missed = data.filter(d => d.status === 'missed').length;
  const late   = data.filter(d => d.status === 'late').length;
  const pct    = total > 0 ? Math.round((taken / total) * 100) : 0;
  const color  = pct >= 80 ? 'green' : pct >= 60 ? 'yellow' : 'red';

  document.getElementById('adh-pct').textContent   = pct + '%';
  document.getElementById('adh-taken').textContent  = taken;
  document.getElementById('adh-missed').textContent = missed;
  document.getElementById('adh-late').textContent   = late;

  const fill = document.getElementById('adh-fill');
  if (fill) {
    fill.style.width      = pct + '%';
    fill.style.background = `var(--${color})`;
  }
}