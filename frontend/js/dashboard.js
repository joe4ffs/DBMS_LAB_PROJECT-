// ============================================================
//  MedTrack | dashboard.js — Overview + Patients section
// ============================================================

// ── Load all stat cards
async function loadStats() {
  const [patients, alerts, doses, rx, meds, interactions] = await Promise.all([
    db.from('patient').select('*', { count:'exact', head:true }),
    db.from('adherencealert').select('*', { count:'exact', head:true }).eq('resolved', false),
    db.from('doselog').select('status').neq('status','pending'),
    db.from('prescription').select('*', { count:'exact', head:true }).eq('status','active'),
    db.from('medicine').select('*', { count:'exact', head:true }),
    db.from('druginteraction').select('*', { count:'exact', head:true }),
  ]);

  setText('s-patients',     patients.count     ?? 0);
  setText('s-alerts',       alerts.count       ?? 0);
  setText('s-rx',           rx.count           ?? 0);
  setText('s-meds',         meds.count         ?? 0);
  setText('s-interactions', interactions.count ?? 0);
  setText('alert-count',    alerts.count       ?? 0);
  setText('alerts-count-badge', alerts.count   ?? 0);

  if (doses.data) {
    const taken = doses.data.filter(d => d.status === 'taken').length;
    const total = doses.data.length;
    const pct   = total > 0 ? Math.round((taken / total) * 100) : 0;
    setText('s-adherence', pct + '%');
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Active alerts panel
async function loadAlerts() {
  const { data } = await db
    .from('adherencealert')
    .select('*, patient(full_name)')
    .eq('resolved', false)
    .order('triggered_at', { ascending: false })
    .limit(8);

  const el = document.getElementById('alerts-list');
  if (!el) return;

  if (!data?.length) {
    el.innerHTML = '<div class="empty">No active alerts 🎉</div>';
    return;
  }

  el.innerHTML = data.map(a => `
    <div class="alert-item">
      <div class="alert-dot ${a.severity}"></div>
      <div style="flex:1">
        <div class="alert-msg">${a.message}</div>
        <div class="alert-time">${new Date(a.triggered_at).toLocaleString()}</div>
      </div>
      <span class="badge ${a.severity==='critical'?'badge-red':a.severity==='high'?'badge-yellow':'badge-blue'}">${a.severity}</span>
    </div>`).join('');
}

// ── Recent dose activity table
async function loadRecentDoses() {
  const { data } = await db
    .from('doselog')
    .select('status, scheduled_at, patient(full_name), medicationschedule(medicine(generic_name))')
    .order('scheduled_at', { ascending: false })
    .limit(8);

  const tbody = document.getElementById('recent-doses');
  if (!tbody) return;

  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty">No dose data</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(d => {
    const badge = d.status==='taken' ? 'badge-green' :
                  d.status==='missed'? 'badge-red'   :
                  d.status==='late'  ? 'badge-yellow': 'badge-blue';
    return `<tr>
      <td><strong>${d.patient?.full_name ?? '—'}</strong></td>
      <td>${d.medicationschedule?.medicine?.generic_name ?? '—'}</td>
      <td><span class="badge ${badge}">${d.status}</span></td>
    </tr>`;
  }).join('');
}

// ── Patient list with adherence + risk
async function loadPatients(search = '') {
  let q = db.from('patient').select('*').order('full_name');
  if (search) q = q.ilike('full_name', `%${search}%`);
  const { data } = await q;

  const tbody = document.getElementById('patient-list');
  if (!tbody) return;

  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No patients found</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted);padding:12px;font-size:12px">Calculating adherence...</td></tr>';

  const rows = await Promise.all(data.map(async p => {
    const { data: doses } = await db
      .from('doselog').select('status')
      .eq('patient_id', p.patient_id).neq('status','pending');

    const total  = doses?.length ?? 0;
    const taken  = doses?.filter(d => d.status==='taken').length  ?? 0;
    const missed = doses?.filter(d => d.status==='missed').length ?? 0;
    const pct    = total > 0 ? Math.round((taken/total)*100) : 0;
    const color  = pct >= 80 ? 'green' : pct >= 60 ? 'yellow' : 'red';
    const riskCls= missed >= 5 ? 'badge-red' : missed >= 2 ? 'badge-yellow' : 'badge-green';
    const riskTxt= missed >= 5 ? 'High Risk' : missed >= 2 ? 'Medium'       : 'Low Risk';
    const age    = new Date().getFullYear() - new Date(p.dob).getFullYear();

    return `<tr>
      <td><strong>${p.full_name}</strong></td>
      <td>${age}</td>
      <td>${p.gender==='M'?'Male':p.gender==='F'?'Female':'Other'}</td>
      <td>${p.blood_group ?? '—'}</td>
      <td>${p.phone}</td>
      <td>
        <div class="adh-wrap">
          <div class="adh-bar">
            <div class="adh-fill" style="width:${pct}%;background:var(--${color})"></div>
          </div>
          <span class="adh-pct" style="color:var(--${color})">${pct}%</span>
        </div>
      </td>
      <td><span class="badge ${riskCls}">${riskTxt}</span></td>
    </tr>`;
  }));

  tbody.innerHTML = rows.join('');
}

function searchPatients(val) { loadPatients(val); }
// Click alert pill to jump to overview and scroll to alerts
document.getElementById('alert-pill')?.addEventListener('click', () => {
  // Switch to overview section
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  document.getElementById('section-overview').classList.add('active');
  document.querySelector('.nav-link')?.classList.add('active');
  document.getElementById('page-title').textContent = 'Dashboard';

  // Scroll to alerts card
  setTimeout(() => {
    document.getElementById('alerts-list')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
});

// ── Init
loadStats();
loadAlerts();
loadRecentDoses();
loadPatients();