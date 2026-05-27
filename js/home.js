import { state, navigate } from './app.js';
import { createSession, getRecentSessions } from './supabase.js';

export async function renderHome(container) {
  container.innerHTML = `
    <div class="screen home-screen">
      <div class="home-header">
        <h1>Range Tracker</h1>
      </div>
      <button id="start-btn" class="btn btn-primary btn-xl">Start Session</button>
      <div class="stat-chips" id="stat-chips">
        <div class="chip"><span class="chip-label">Accuracy</span><span class="chip-value" id="chip-acc">—</span></div>
        <div class="chip"><span class="chip-label">Best</span><span class="chip-value" id="chip-best">—</span></div>
        <div class="chip"><span class="chip-label">Needs Work</span><span class="chip-value" id="chip-worst">—</span></div>
      </div>
      <div class="section">
        <h2 class="section-title">Recent Sessions</h2>
        <div id="sessions-list"><div class="loading-text">Loading…</div></div>
      </div>
    </div>
  `;

  document.getElementById('start-btn').addEventListener('click', async () => {
    const btn = document.getElementById('start-btn');
    btn.textContent = 'Starting…';
    btn.disabled = true;

    const { data, error } = await createSession(state.user.id);
    if (error) {
      btn.textContent = 'Start Session';
      btn.disabled = false;
      return;
    }

    state.activeSession      = { ...data, shots: [] };
    state.currentClubIndex   = 0;
    navigate('session');
  });

  const { data: sessions } = await getRecentSessions(state.user.id, 10);
  renderSessionsList(sessions || []);
  renderStats(sessions || []);
}

function renderSessionsList(sessions) {
  const list = document.getElementById('sessions-list');
  if (!sessions.length) {
    list.innerHTML = '<p class="empty-state">No sessions yet — hit some balls!</p>';
    return;
  }

  list.innerHTML = sessions.map((s) => {
    const shots    = s.shots || [];
    const hits     = shots.filter((sh) => sh.result === 'hit').length;
    const accuracy = shots.length ? Math.round((hits / shots.length) * 100) : 0;
    const date     = new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dur      = s.ended_at ? duration(s.started_at, s.ended_at) : 'In progress';
    const cls      = accuracy >= 70 ? 'good' : accuracy >= 50 ? 'ok' : 'bad';
    return `
      <div class="session-card">
        <div class="session-meta">
          <span class="session-date">${date}</span>
          <span class="session-dur">${dur}</span>
        </div>
        <div class="session-stats">
          <span class="session-shots">${shots.length} shots</span>
          <span class="session-acc ${cls}">${accuracy}%</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderStats(sessions) {
  const allShots = sessions.flatMap((s) => s.shots || []);
  if (!allShots.length) return;

  const hits     = allShots.filter((s) => s.result === 'hit').length;
  const accuracy = Math.round((hits / allShots.length) * 100);
  document.getElementById('chip-acc').textContent = `${accuracy}%`;

  const byClub = {};
  allShots.forEach((shot) => {
    const name = shot.clubs?.abbreviation || '?';
    if (!byClub[name]) byClub[name] = { hits: 0, total: 0 };
    byClub[name].total++;
    if (shot.result === 'hit') byClub[name].hits++;
  });

  const ranked = Object.entries(byClub)
    .filter(([, s]) => s.total >= 5)
    .map(([name, s]) => ({ name, pct: s.hits / s.total }))
    .sort((a, b) => b.pct - a.pct);

  if (ranked.length) {
    document.getElementById('chip-best').textContent  = ranked[0].name;
    document.getElementById('chip-worst').textContent = ranked[ranked.length - 1].name;
  }
}

function duration(start, end) {
  const mins = Math.round((new Date(end) - new Date(start)) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
