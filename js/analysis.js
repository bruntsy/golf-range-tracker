import { state } from './app.js';
import { getRecentSessions } from './supabase.js';

let sessions = [];
let activeTab = 'trends';
let chartInstances = [];

export async function renderAnalysis(container) {
  container.innerHTML = `
    <div class="screen analysis-screen">
      <h1>Analysis</h1>
      <div class="tab-bar">
        <button class="tab-btn ${activeTab === 'trends' ? 'active' : ''}" data-tab="trends">Trends</button>
        <button class="tab-btn ${activeTab === 'clubs'  ? 'active' : ''}" data-tab="clubs">Clubs</button>
      </div>
      <div id="tab-content"><div class="loading-text">Loading…</div></div>
    </div>
  `;

  document.querySelector('.tab-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn || btn.dataset.tab === activeTab) return;
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.tab === activeTab)
    );
    renderTab();
  });

  const { data } = await getRecentSessions(state.user.id, 20);
  sessions = data || [];
  renderTab();
}

function renderTab() {
  chartInstances.forEach((c) => c.destroy());
  chartInstances = [];
  activeTab === 'trends' ? renderTrends() : renderClubs();
}

// ── Trends ────────────────────────────────────────────────────────────────────

function renderTrends() {
  const content  = document.getElementById('tab-content');
  const last10   = sessions.slice(0, 10).reverse();
  const allShots = sessions.flatMap((s) => s.shots || []);
  const misses   = { left: 0, right: 0, long: 0, short: 0 };
  allShots.filter((s) => s.result !== 'hit').forEach((s) => misses[s.result]++);

  content.innerHTML = `
    <div class="chart-card">
      <h3>Accuracy Trend</h3>
      <div class="chart-wrap"><canvas id="trend-chart"></canvas></div>
    </div>
    <div class="chart-card">
      <h3>Miss Direction</h3>
      <div class="chart-wrap chart-wrap-sm"><canvas id="miss-chart"></canvas></div>
    </div>
    <div class="section">
      <h3 class="section-title">Session History</h3>
      ${sessions.map(sessionRow).join('') || '<p class="empty-state">No sessions yet.</p>'}
    </div>
  `;

  importChart().then((Chart) => {
    chartInstances.push(new Chart(document.getElementById('trend-chart'), {
      type: 'line',
      data: {
        labels: last10.map((s) => fmtDate(s.started_at)),
        datasets: [{
          label: 'Hit %',
          data: last10.map((s) => {
            const shots = s.shots || [];
            return shots.length
              ? Math.round((shots.filter((sh) => sh.result === 'hit').length / shots.length) * 100)
              : 0;
          }),
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22,163,74,0.15)',
          tension: 0.35,
          fill: true,
          pointBackgroundColor: '#16a34a',
        }],
      },
      options: lineOptions(100, '%'),
    }));

    const missTotal = Object.values(misses).reduce((a, b) => a + b, 0);
    chartInstances.push(new Chart(document.getElementById('miss-chart'), {
      type: 'doughnut',
      data: {
        labels: ['Left', 'Right', 'Long', 'Short'],
        datasets: [{
          data: [misses.left, misses.right, misses.long, misses.short],
          backgroundColor: ['#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'],
          borderColor: '#1e293b',
          borderWidth: 2,
        }],
      },
      options: {
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 13 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pct = missTotal ? Math.round((ctx.parsed / missTotal) * 100) : 0;
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
              },
            },
          },
        },
        responsive: true,
        maintainAspectRatio: true,
      },
    }));
  });
}

// ── Clubs ─────────────────────────────────────────────────────────────────────

function renderClubs() {
  const content  = document.getElementById('tab-content');
  const allShots = sessions.flatMap((s) => s.shots || []);
  const byClub   = {};

  allShots.forEach((sh) => {
    const id   = sh.clubs?.id;
    const abbr = sh.clubs?.abbreviation || '?';
    const name = sh.clubs?.name || '?';
    if (!byClub[id]) byClub[id] = { abbr, name, shots: [] };
    byClub[id].shots.push(sh);
  });

  const clubs = Object.values(byClub).sort((a, b) => b.shots.length - a.shots.length);

  content.innerHTML = `
    <div class="chart-card">
      <h3>Accuracy by Club</h3>
      <div class="chart-wrap"><canvas id="club-chart"></canvas></div>
    </div>
    <div class="club-stat-list">
      ${clubs.map((c) => {
        const hits = c.shots.filter((s) => s.result === 'hit').length;
        const pct  = Math.round((hits / c.shots.length) * 100);
        const tend = missTendency(c.shots);
        const cls  = pct >= 70 ? 'good' : pct >= 50 ? 'ok' : 'bad';
        return `
          <div class="club-stat-row">
            <span class="csr-abbr">${c.abbr}</span>
            <div class="csr-bar-wrap">
              <div class="csr-bar ${cls}" style="width:${pct}%"></div>
            </div>
            <span class="csr-pct ${cls}">${pct}%</span>
            <span class="csr-tend">${tend ? tend : '—'}</span>
          </div>`;
      }).join('')}
    </div>
  `;

  importChart().then((Chart) => {
    chartInstances.push(new Chart(document.getElementById('club-chart'), {
      type: 'bar',
      data: {
        labels: clubs.map((c) => c.abbr),
        datasets: [{
          data: clubs.map((c) => {
            const hits = c.shots.filter((s) => s.result === 'hit').length;
            return Math.round((hits / c.shots.length) * 100);
          }),
          backgroundColor: clubs.map((c) => {
            const hits = c.shots.filter((s) => s.result === 'hit').length;
            const pct  = (hits / c.shots.length) * 100;
            return pct >= 70 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#ef4444';
          }),
          borderRadius: 4,
        }],
      },
      options: lineOptions(100, '%'),
    }));
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sessionRow(s) {
  const shots = s.shots || [];
  const hits  = shots.filter((sh) => sh.result === 'hit').length;
  const pct   = shots.length ? Math.round((hits / shots.length) * 100) : 0;
  const cls   = pct >= 70 ? 'good' : pct >= 50 ? 'ok' : 'bad';
  return `
    <div class="session-row">
      <span class="session-date">${fmtDate(s.started_at)}</span>
      <span class="session-shots">${shots.length} shots</span>
      <span class="session-acc ${cls}">${pct}%</span>
    </div>`;
}

function missTendency(shots) {
  const misses = shots.filter((s) => s.result !== 'hit');
  if (!misses.length) return '';
  const counts = { left: 0, right: 0, long: 0, short: 0 };
  misses.forEach((s) => counts[s.result]++);
  const [top] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return top[1] > 0 ? top[0] : '';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function lineOptions(yMax, suffix) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#1e293b' } },
      y: {
        min: 0, max: yMax,
        ticks: { color: '#94a3b8', callback: (v) => v + suffix, font: { size: 11 } },
        grid: { color: '#1e293b' },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y}${suffix}` } },
    },
  };
}

let ChartClass;
async function importChart() {
  if (ChartClass) return ChartClass;
  const { Chart, registerables } = await import('https://cdn.jsdelivr.net/npm/chart.js@4/+esm');
  Chart.register(...registerables);
  ChartClass = Chart;
  return Chart;
}
