// ============================================================
//  MedTrack | frontend/js/charts.js
//  Adherence and recovery charts using Chart.js
// ============================================================

async function loadAdherenceChart(patientId) {
  const { data } = await db
    .from('doselog')
    .select('scheduled_at, status')
    .eq('patient_id', patientId)
    .neq('status', 'pending')
    .order('scheduled_at');

  if (!data || !data.length) return;

  // Group by date
  const byDate = {};
  data.forEach(d => {
    const date = d.scheduled_at.split('T')[0];
    if (!byDate[date]) byDate[date] = { taken: 0, total: 0 };
    byDate[date].total++;
    if (d.status === 'taken') byDate[date].taken++;
  });

  const labels = Object.keys(byDate).sort();
  const values = labels.map(d => Math.round((byDate[d].taken / byDate[d].total) * 100));

  const ctx = document.getElementById('adherence-chart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Adherence %',
        data: values,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#10b981',
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#e2e8f0' } }
      },
      scales: {
        x: { ticks: { color: '#8892a4' }, grid: { color: '#2a2d3e' } },
        y: {
          ticks: { color: '#8892a4', callback: v => v + '%' },
          grid: { color: '#2a2d3e' },
          min: 0, max: 100
        }
      }
    }
  });
}

async function loadRecoveryChart(patientId) {
  const { data } = await db
    .from('recoverylog')
    .select('log_date, symptom_score, recovery_score')
    .eq('patient_id', patientId)
    .order('log_date');

  if (!data || !data.length) return;

  const ctx = document.getElementById('recovery-chart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.log_date),
      datasets: [
        {
          label: 'Recovery Score',
          data: data.map(d => d.recovery_score),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#3b82f6',
          pointRadius: 4,
        },
        {
          label: 'Symptom Score',
          data: data.map(d => d.symptom_score),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#ef4444',
          pointRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#e2e8f0' } }
      },
      scales: {
        x: { ticks: { color: '#8892a4' }, grid: { color: '#2a2d3e' } },
        y: {
          ticks: { color: '#8892a4' },
          grid: { color: '#2a2d3e' },
          min: 0, max: 10
        }
      }
    }
  });
}

async function loadDoseStatusChart(patientId) {
  const { data } = await db
    .from('doselog')
    .select('status')
    .eq('patient_id', patientId)
    .neq('status', 'pending');

  if (!data || !data.length) return;

  const taken  = data.filter(d => d.status === 'taken').length;
  const missed = data.filter(d => d.status === 'missed').length;
  const late   = data.filter(d => d.status === 'late').length;

  const ctx = document.getElementById('status-chart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Taken', 'Missed', 'Late'],
      datasets: [{
        data: [taken, missed, late],
        backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#e2e8f0' } }
      }
    }
  });
}