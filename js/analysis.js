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

  const dist = { hit: 0, left: 0, right: 0, long: 0, short: 0 };
  allShots.forEach((s) => dist[s.result]++);
  const total = allShots.length || 1;

  content.innerHTML = `
    ${last10.length > 1 ? `
    <div class="chart-card">
      <h3>Accuracy Trend</h3>
      <div class="chart-wrap"><canvas id="trend-chart"></canvas></div>
    </div>` : ''}

    <div class="chart-card">
      <h3>Shot Distribution <span class="dist-total">${allShots.length} shots</span></h3>
      ${shotDistGrid(dist, total)}
    </div>

    <div class="section">
      <h3 class="section-title">Session History</h3>
      ${sessions.map(sessionRow).join('') || '<p class="empty-state">No sessions yet.</p>'}
    </div>
  `;

  if (last10.length > 1) {
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
    });
  }
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

  if (!clubs.length) {
    content.innerHTML = '<p class="empty-state">No shots logged yet.</p>';
    return;
  }

  content.innerHTML = `
    <div class="club-cards">
      ${clubs.map((c) => {
        const hits  = c.shots.filter((s) => s.result === 'hit').length;
        const pct   = Math.round((hits / c.shots.length) * 100);
        const cls   = pct >= 70 ? 'good' : pct >= 50 ? 'ok' : 'bad';
        const tend  = missTendency(c.shots);
        const arrow = { left: '←', right: '→', long: '↑', short: '↓' }[tend] || '—';
        const dist  = { hit: 0, left: 0, right: 0, long: 0, short: 0 };
        c.shots.forEach((s) => dist[s.result]++);
        const t = c.shots.length || 1;
        return `
          <div class="club-card">
            <div class="club-card-header">
              <span class="club-card-name">${c.name}</span>
              <span class="club-card-meta">${c.shots.length} shots</span>
            </div>
            <div class="club-card-body">
              <div class="club-card-acc">
                <span class="club-card-pct ${cls}">${pct}%</span>
                <span class="club-card-label">accuracy</span>
              </div>
              <div class="club-card-miss">
                <span class="miss-arrow ${tend}">${arrow}</span>
                <span class="club-card-label">${tend || 'no miss'}</span>
              </div>
              <div class="club-mini-dist">
                ${shotDistGrid(dist, t, true)}
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
}

// ── Shot Distribution Grid ────────────────────────────────────────────────────

function shotDistGrid(dist, total, mini = false) {
  const pct  = (k) => Math.round((dist[k] / total) * 100);
  const cls  = mini ? 'dist-grid dist-grid-mini' : 'dist-grid';

  // Intensity: how prominent to make each miss cell (0–1)
  const maxMiss = Math.max(dist.left, dist.right, dist.long, dist.short, 1);
  const intensity = (k) => (dist[k] / maxMiss).toFixed(2);

  return `
    <div class="${cls}">
      <div class="dist-cell dist-long"  style="--i:${intensity('long')}">
        <span class="dist-pct">${pct('long')}%</span>
        ${!mini ? '<span class="dist-label">LONG</span>' : ''}
      </div>
      <div class="dist-cell dist-left"  style="--i:${intensity('left')}">
        <span class="dist-pct">${pct('left')}%</span>
        ${!mini ? '<span class="dist-label">LEFT</span>' : ''}
      </div>
      <div class="dist-cell dist-hit">
        <span class="dist-pct">${pct('hit')}%</span>
        ${!mini ? '<span class="dist-label">HIT</span>' : ''}
      </div>
      <div class="dist-cell dist-right" style="--i:${intensity('right')}">
        <span class="dist-pct">${pct('right')}%</span>
        ${!mini ? '<span class="dist-label">RIGHT</span>' : ''}
      </div>
      <div class="dist-cell dist-short" style="--i:${intensity('short')}">
        <span class="dist-pct">${pct('short')}%</span>
        ${!mini ? '<span class="dist-label">SHORT</span>' : ''}
      </div>
    </div>
  `;
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
