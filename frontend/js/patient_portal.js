// ============================================================
//  MedTrack | patient_portal.js
//  All logic for the patient portal — loads data for the
//  currently logged-in patient only
// ============================================================

let PATIENT_ID = null;

// ── Tab navigation
function showTab(name, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (el) el.classList.add('active');
  const titles = {
    overview: 'My Health Overview', medicines: 'My Medicines',
    recovery: 'Recovery Log', prescriptions: 'My Prescriptions',
    sideeffects: 'Side Effects', history: 'My History'
  };
  document.getElementById('page-title').textContent = titles[name] || name;
}

// ── Score range label
function updateScoreLabel(inputId, labelId) {
  document.getElementById(labelId).textContent = document.getElementById(inputId).value;
}

// ── Wait for auth then boot
async function init() {
  // Wait for guard.js to set CURRENT_USER
  let waited = 0;
  while (!window.CURRENT_USER && waited < 3000) {
    await new Promise(r => setTimeout(r, 100));
    waited += 100;
  }

  const user = window.CURRENT_USER;
  if (!user) { window.location.replace('auth/login.html'); return; }

  // Get linked patient_id from user_profiles
  const { data: profile } = await db
    .from('user_profiles')
    .select('linked_id, full_name, role')
    .eq('id', user.id)
    .single();

  // Welcome message
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('welcome-name').textContent = `${greeting}, ${profile?.full_name ?? user.name}! 👋`;

  if (!profile?.linked_id) {
    // No linked patient yet — show message
    document.getElementById('welcome-sub').textContent = 'Your account is not linked to a patient record yet. Please contact your doctor.';
    showNoPatientMessage();
    return;
  }

  PATIENT_ID = profile.linked_id;
  document.getElementById('welcome-sub').textContent = "Here's your health summary for today";

  // Load everything
  loadAdherenceStats();
  loadTodayDoses();
  loadAdherenceChart();
  loadRecoveryChart();
  loadMyMedicines();
  loadDoseHistory();
  loadRecoveryHistory();
  loadMyPrescriptions();
  loadMedicineDropdown();
  loadMySideEffects();
  loadMyAppointments();
  loadStatusChart();
}

function showNoPatientMessage() {
  ['today-doses','my-medicines','dose-history','my-prescriptions','my-side-effects','my-appointments','recovery-history']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<tr><td colspan="6" class="empty">No patient record linked to your account yet.</td></tr>';
    });
}

// ── Adherence stats
async function loadAdherenceStats() {
  const { data } = await db.from('doselog').select('status').eq('patient_id', PATIENT_ID).neq('status','pending');
  if (!data) return;
  const total  = data.length;
  const taken  = data.filter(d => d.status === 'taken').length;
  const missed = data.filter(d => d.status === 'missed').length;
  const late   = data.filter(d => d.status === 'late').length;
  const pct    = total > 0 ? Math.round((taken / total) * 100) : 0;
  document.getElementById('p-adherence').textContent = pct + '%';
  document.getElementById('p-taken').textContent     = taken;
  document.getElementById('p-missed').textContent    = missed;
  document.getElementById('p-late').textContent      = late;
}

// ── Today's doses
async function loadTodayDoses() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await db
    .from('doselog')
    .select('log_id, status, scheduled_at, medicationschedule(dose_time, medicine(generic_name, brand_name, dosage_type))')
    .eq('patient_id', PATIENT_ID)
    .gte('scheduled_at', today + 'T00:00:00')
    .lte('scheduled_at', today + 'T23:59:59')
    .order('scheduled_at');

  const el = document.getElementById('today-doses');
  document.getElementById('today-count').textContent = data?.length ?? 0;

  if (!data?.length) {
    el.innerHTML = '<div class="empty">No doses scheduled for today 🎉</div>';
    return;
  }

  el.innerHTML = data.map(d => {
    const med   = d.medicationschedule?.medicine;
    const badge = d.status === 'taken'  ? 'badge-green'  :
                  d.status === 'missed' ? 'badge-red'    :
                  d.status === 'late'   ? 'badge-yellow' : 'badge-blue';
    const btn = (d.status === 'pending' || d.status === 'missed')
      ? `<button class="btn btn-green" style="padding:5px 12px;font-size:12px" onclick="markTaken(${d.log_id})">✓ Mark Taken</button>`
      : `<span class="badge ${badge}">${d.status}</span>`;
    return `<div class="dose-row">
      <div>
        <div style="font-size:13px;font-weight:500">${med?.generic_name ?? '—'} <span style="color:var(--muted);font-weight:400">(${med?.brand_name ?? ''})</span></div>
        <div style="font-size:11px;color:var(--muted);margin-top:3px">${d.medicationschedule?.dose_time ?? ''} · ${med?.dosage_type ?? ''}</div>
      </div>
      ${btn}
    </div>`;
  }).join('');
}

// ── Mark dose as taken
async function markTaken(logId) {
  const { error } = await db.from('doselog')
    .update({ status: 'taken', taken_at: new Date().toISOString() })
    .eq('log_id', logId);
  if (error) { alert('Error: ' + error.message); return; }
  loadTodayDoses();
  loadAdherenceStats();
}

// ── Adherence chart
async function loadAdherenceChart() {
  const { data } = await db.from('doselog')
    .select('scheduled_at, status')
    .eq('patient_id', PATIENT_ID)
    .neq('status','pending')
    .order('scheduled_at');
  if (!data?.length) return;

  const byDate = {};
  data.forEach(d => {
    const date = d.scheduled_at.split('T')[0];
    if (!byDate[date]) byDate[date] = { taken:0, total:0 };
    byDate[date].total++;
    if (d.status === 'taken') byDate[date].taken++;
  });
  const labels = Object.keys(byDate).sort();
  const values = labels.map(d => Math.round((byDate[d].taken / byDate[d].total) * 100));

  new Chart(document.getElementById('p-adherence-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Adherence %', data: values, borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: true, pointRadius: 4 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: '#1f2937' } },
        y: { min:0, max:100, ticks: { color: '#64748b', callback: v => v+'%' }, grid: { color: '#1f2937' } }
      }
    }
  });
}

// ── Recovery chart
async function loadRecoveryChart() {
  const { data } = await db.from('recoverylog')
    .select('log_date, symptom_score, recovery_score')
    .eq('patient_id', PATIENT_ID)
    .order('log_date');
  if (!data?.length) return;

  new Chart(document.getElementById('p-recovery-chart'), {
    type: 'line',
    data: {
      labels: data.map(d => d.log_date),
      datasets: [
        { label: 'Recovery', data: data.map(d => d.recovery_score), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.4, fill: true },
        { label: 'Symptoms', data: data.map(d => d.symptom_score),  borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)',  tension: 0.4, fill: true }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: '#1f2937' } },
        y: { min:0, max:10, ticks: { color: '#64748b' }, grid: { color: '#1f2937' } }
      }
    }
  });
}

// ── Status doughnut chart
async function loadStatusChart() {
  const { data } = await db.from('doselog').select('status').eq('patient_id', PATIENT_ID).neq('status','pending');
  if (!data?.length) return;
  const taken  = data.filter(d => d.status==='taken').length;
  const missed = data.filter(d => d.status==='missed').length;
  const late   = data.filter(d => d.status==='late').length;
  new Chart(document.getElementById('p-status-chart'), {
    type: 'doughnut',
    data: {
      labels: ['Taken', 'Missed', 'Late'],
      datasets: [{ data: [taken, missed, late], backgroundColor: ['#10b981','#ef4444','#f59e0b'], borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } } }
  });
}

// ── My medicines
async function loadMyMedicines() {
  const { data } = await db
    .from('medicationschedule')
    .select('dose_time, frequency, medicine(generic_name, brand_name, dosage_type), prescription(status)')
    .eq('prescription.patient_id', PATIENT_ID);

  const tbody = document.getElementById('my-medicines');
  if (!data?.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No medicines scheduled</td></tr>'; return; }
  tbody.innerHTML = data.map(s => `<tr>
    <td><strong>${s.medicine?.generic_name ?? '—'}</strong></td>
    <td>${s.medicine?.brand_name ?? '—'}</td>
    <td>${s.dose_time ?? '—'}</td>
    <td><spanasync function loadMyMedicines() {
  const { data } = await db
    .from('medicationschedule')
    .select('dose_time, frequency, medicine(generic_name, brand_name, dosage_type)')
    .order('dose_time');

  const tbody = document.getElementById('my-medicines');
  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">No medicines scheduled</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(s => `<tr>
    <td><strong>${s.medicine?.generic_name ?? '—'}</strong></td>
    <td>${s.medicine?.brand_name ?? '—'}</td>
    <td>${s.dose_time ?? '—'}</td>
    <td><span class="badge badge-blue">${s.frequency?.replace(/_/g,' ') ?? '—'}</span></td>
    <td><span class="badge badge-purple">${s.medicine?.dosage_type ?? '—'}</span></td>
  </tr>`).join('');
}

// ── Dose history
async function loadDoseHistory() {
  const { data } = await db
    .from('doselog')
    .select('status, scheduled_at, taken_at, medicationschedule(medicine(generic_name))')
    .eq('patient_id', PATIENT_ID)
    .order('scheduled_at', { ascending: false })
    .limit(30);

  const tbody = document.getElementById('dose-history');
  if (!data?.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">No dose history</td></tr>'; return; }
  tbody.innerHTML = data.map(d => {
    const badge = d.status==='taken' ? 'badge-green' : d.status==='missed' ? 'badge-red' : d.status==='late' ? 'badge-yellow' : 'badge-blue';
    return `<tr>
      <td>${d.medicationschedule?.medicine?.generic_name ?? '—'}</td>
      <td>${new Date(d.scheduled_at).toLocaleString()}</td>
      <td>${d.taken_at ? new Date(d.taken_at).toLocaleString() : '—'}</td>
      <td><span class="badge ${badge}">${d.status}</span></td>
    </tr>`;
  }).join('');
}

// ── Recovery history
async function loadRecoveryHistory() {
  const { data } = await db.from('recoverylog')
    .select('log_date, symptom_score, recovery_score, notes')
    .eq('patient_id', PATIENT_ID)
    .order('log_date', { ascending: false });

  const tbody = document.getElementById('recovery-history');
  if (!data?.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">No recovery logs yet</td></tr>'; return; }
  tbody.innerHTML = data.map(r => `<tr>
    <td>${r.log_date}</td>
    <td><span class="badge badge-${r.symptom_score >= 7 ? 'red' : r.symptom_score >= 4 ? 'yellow' : 'green'}">${r.symptom_score}/10</span></td>
    <td><span class="badge badge-${r.recovery_score >= 7 ? 'green' : r.recovery_score >= 4 ? 'yellow' : 'red'}">${r.recovery_score}/10</span></td>
    <td>${r.notes ?? '—'}</td>
  </tr>`).join('');
}

// ── Submit recovery log
async function submitRecoveryLog() {
  const symptom  = parseInt(document.getElementById('symptom-score').value);
  const recovery = parseInt(document.getElementById('recovery-score').value);
  const notes    = document.getElementById('recovery-notes').value;
  const today    = new Date().toISOString().split('T')[0];
  const msgEl    = document.getElementById('recovery-log-msg');

  const { error } = await db.from('recoverylog').upsert({
    patient_id: PATIENT_ID, log_date: today,
    symptom_score: symptom, recovery_score: recovery, notes
  }, { onConflict: 'patient_id,log_date' });

  if (error) {
    msgEl.innerHTML = `<div class="result-danger" style="padding:8px 12px;border-radius:6px">Error: ${error.message}</div>`;
  } else {
    msgEl.innerHTML = `<div class="result-safe" style="padding:8px 12px;border-radius:6px">✅ Recovery log saved!</div>`;
    loadRecoveryHistory();
    setTimeout(() => msgEl.innerHTML = '', 3000);
  }
}

// ── My prescriptions
async function loadMyPrescriptions() {
  const { data } = await db
    .from('prescription')
    .select('start_date, end_date, notes, status, appointment(doctor(full_name))')
    .order('created_at', { ascending: false });

  const tbody = document.getElementById('my-prescriptions');
  if (!data?.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No prescriptions found</td></tr>'; return; }
  tbody.innerHTML = data.map(r => {
    const badge = r.status==='active' ? 'badge-green' : r.status==='completed' ? 'badge-blue' : 'badge-red';
    return `<tr>
      <td>${r.appointment?.doctor?.full_name ?? '—'}</td>
      <td>${r.start_date}</td>
      <td>${r.end_date}</td>
      <td>${r.notes ?? '—'}</td>
      <td><span class="badge ${badge}">${r.status}</span></td>
    </tr>`;
  }).join('');
}

// ── Medicine dropdown for side effects
async function loadMedicineDropdown() {
  const { data } = await db.from('medicine').select('medicine_id, generic_name, brand_name').order('generic_name');
  const sel = document.getElementById('se-medicine');
  sel.innerHTML = '<option value="">Select medicine...</option>' +
    (data ?? []).map(m => `<option value="${m.medicine_id}">${m.generic_name} (${m.brand_name ?? '—'})</option>`).join('');
}

// ── Submit side effect
async function submitSideEffect() {
  const med      = parseInt(document.getElementById('se-medicine').value);
  const effect   = document.getElementById('se-effect').value.trim();
  const severity = document.getElementById('se-severity').value;
  const notes    = document.getElementById('se-notes').value;
  const msgEl    = document.getElementById('se-msg');

  if (!med || !effect) {
    msgEl.innerHTML = `<div class="result-warning" style="padding:8px 12px;border-radius:6px">Please select a medicine and describe the effect.</div>`;
    return;
  }

  const { error } = await db.from('sideeffectreport').insert({
    patient_id: PATIENT_ID, medicine_id: med,
    effect_name: effect, severity, notes
  });

  if (error) {
    msgEl.innerHTML = `<div class="result-danger" style="padding:8px 12px;border-radius:6px">Error: ${error.message}</div>`;
  } else {
    msgEl.innerHTML = `<div class="result-safe" style="padding:8px 12px;border-radius:6px">✅ Side effect reported!</div>`;
    loadMySideEffects();
    document.getElementById('se-effect').value = '';
    document.getElementById('se-notes').value  = '';
    setTimeout(() => msgEl.innerHTML = '', 3000);
  }
}

// ── My side effects
async function loadMySideEffects() {
  const { data } = await db.from('sideeffectreport')
    .select('effect_name, severity, reported_at, medicine(generic_name)')
    .eq('patient_id', PATIENT_ID)
    .order('reported_at', { ascending: false });

  const tbody = document.getElementById('my-side-effects');
  if (!data?.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">No side effects reported</td></tr>'; return; }
  tbody.innerHTML = data.map(s => {
    const badge = s.severity==='high' ? 'badge-red' : s.severity==='medium' ? 'badge-yellow' : 'badge-green';
    return `<tr>
      <td>${s.medicine?.generic_name ?? '—'}</td>
      <td>${s.effect_name}</td>
      <td><span class="badge ${badge}">${s.severity}</span></td>
      <td>${new Date(s.reported_at).toLocaleDateString()}</td>
    </tr>`;
  }).join('');
}

// ── My appointments
async function loadMyAppointments() {
  const { data } = await db.from('appointment')
    .select('appointment_date, symptoms, status, doctor(full_name)')
    .eq('patient_id', PATIENT_ID)
    .order('appointment_date', { ascending: false });

  const tbody = document.getElementById('my-appointments');
  if (!data?.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">No appointments found</td></tr>'; return; }
  tbody.innerHTML = data.map(a => {
    const badge = a.status==='completed' ? 'badge-green' : a.status==='scheduled' ? 'badge-blue' : 'badge-red';
    return `<tr>
      <td>${a.doctor?.full_name ?? '—'}</td>
      <td>${new Date(a.appointment_date).toLocaleDateString()}</td>
      <td>${a.symptoms ?? '—'}</td>
      <td><span class="badge ${badge}">${a.status}</span></td>
    </tr>`;
  }).join('');
}

// ── Boot
document.addEventListener('DOMContentLoaded', init);