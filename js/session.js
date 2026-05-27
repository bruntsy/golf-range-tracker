import { state, navigate } from './app.js';
import { insertShot, undoShot, endSession } from './supabase.js';
import { queueShot, getQueueCount } from './offline.js';

let shotNumber = 0;
let swipeStartX = 0;

export function renderSession(container) {
  if (!state.activeSession) { navigate('home'); return; }
  if (!state.clubs.length)  { navigate('settings'); return; }

  shotNumber = state.activeSession.shots?.length || 0;

  container.innerHTML = `
    <div class="screen session-screen">
      <div class="session-header">
        <button class="club-nav" id="prev-club" aria-label="Previous club">&#8249;</button>
        <div class="club-center" id="club-center">
          <div class="club-name" id="club-name">${currentClub().name}</div>
          <div class="club-stats" id="club-stats">${clubStats()}</div>
        </div>
        <button class="club-nav" id="next-club" aria-label="Next club">&#8250;</button>
      </div>

      <div class="shot-area">
        <div class="shot-grid" id="shot-grid">
          <div class="shot-btn miss long"  data-result="long">LONG</div>
          <div class="shot-btn miss left"  data-result="left">LEFT</div>
          <div class="shot-btn hit"        data-result="hit">HIT</div>
          <div class="shot-btn miss right" data-result="right">RIGHT</div>
          <div class="shot-btn miss short" data-result="short">SHORT</div>
        </div>
      </div>

      <div class="session-footer">
        <button class="btn btn-ghost" id="undo-btn">↩ Undo</button>
        <div class="session-total" id="session-total">${shotNumber} shots</div>
        <button class="btn btn-danger" id="end-btn">End</button>
      </div>

      <div id="feedback" class="feedback" aria-live="polite"></div>
      <div id="offline-badge" class="offline-badge hidden">● Offline</div>
    </div>
  `;

  updateOfflineBadge();

  // Shot logging
  document.getElementById('shot-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-result]');
    if (btn) logShot(btn.dataset.result);
  });

  // Touch feedback on shot buttons
  document.querySelectorAll('.shot-btn').forEach((btn) => {
    btn.addEventListener('pointerdown', () => btn.classList.add('pressing'));
    btn.addEventListener('pointerup',   () => btn.classList.remove('pressing'));
    btn.addEventListener('pointerout',  () => btn.classList.remove('pressing'));
  });

  // Club switching
  document.getElementById('prev-club').addEventListener('click', () => changeClub(-1));
  document.getElementById('next-club').addEventListener('click', () => changeClub(1));

  // Swipe on club center area
  const center = document.getElementById('club-center');
  center.addEventListener('touchstart', (e) => { swipeStartX = e.touches[0].clientX; }, { passive: true });
  center.addEventListener('touchend',   (e) => {
    const dx = e.changedTouches[0].clientX - swipeStartX;
    if (Math.abs(dx) > 40) changeClub(dx > 0 ? -1 : 1);
  }, { passive: true });

  document.getElementById('undo-btn').addEventListener('click', handleUndo);
  document.getElementById('end-btn').addEventListener('click', handleEnd);

  window.addEventListener('online',  updateOfflineBadge);
  window.addEventListener('offline', updateOfflineBadge);
}

async function logShot(result) {
  shotNumber++;
  const club = currentClub();

  const shot = {
    session_id:  state.activeSession.id,
    club_id:     club.id,
    result,
    shot_number: shotNumber,
  };

  state.activeSession.shots.push({ ...shot, clubs: club });
  refreshStats();
  showFeedback(result);

  const { error } = await insertShot(shot.session_id, shot.club_id, result, shotNumber);
  if (error) {
    await queueShot(shot);
    updateOfflineBadge();
  }
}

async function handleUndo() {
  const shots = state.activeSession.shots;
  if (!shots.length) return;

  const last = shots[shots.length - 1];
  shots.pop();
  shotNumber = Math.max(0, shotNumber - 1);

  await undoShot(state.activeSession.id, last.shot_number);
  refreshStats();
}

function changeClub(dir) {
  const len = state.clubs.length;
  state.currentClubIndex = (state.currentClubIndex + dir + len) % len;
  document.getElementById('club-name').textContent = currentClub().name;
  document.getElementById('club-stats').textContent = clubStats();
}

function refreshStats() {
  document.getElementById('club-stats').textContent  = clubStats();
  document.getElementById('session-total').textContent = `${shotNumber} shots`;
}

function clubStats() {
  const club  = currentClub();
  const shots = (state.activeSession.shots || []).filter((s) => s.club_id === club.id);
  if (!shots.length) return 'No shots yet';
  const hits = shots.filter((s) => s.result === 'hit').length;
  const pct  = Math.round((hits / shots.length) * 100);
  const tend = missTendency(shots);
  return `${shots.length} shots · ${pct}% hit${tend ? ` · tends ${tend}` : ''}`;
}

function missTendency(shots) {
  const misses = shots.filter((s) => s.result !== 'hit');
  if (!misses.length) return '';
  const counts = { left: 0, right: 0, long: 0, short: 0 };
  misses.forEach((s) => counts[s.result]++);
  const [top] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return top[1] > 0 ? top[0] : '';
}

function showFeedback(result) {
  const el = document.getElementById('feedback');
  if (!el) return;
  el.textContent  = result === 'hit' ? '✓ HIT' : `✗ ${result.toUpperCase()}`;
  el.className    = `feedback ${result === 'hit' ? 'feedback-hit' : 'feedback-miss'} show`;
  setTimeout(() => el.classList.remove('show'), 700);
}

async function updateOfflineBadge() {
  const badge = document.getElementById('offline-badge');
  if (!badge) return;
  const count   = await getQueueCount();
  const offline = !navigator.onLine;
  badge.classList.toggle('hidden', !offline && count === 0);
  badge.textContent = offline
    ? `● Offline${count ? ` · ${count} queued` : ''}`
    : `↑ ${count} queued`;
}

async function handleEnd() {
  const btn = document.getElementById('end-btn');
  btn.textContent = 'Saving…';
  btn.disabled    = true;

  await endSession(state.activeSession.id, null, null);
  renderSummary();
}

function renderSummary() {
  const shots  = state.activeSession.shots || [];
  const byClub = {};

  shots.forEach((s) => {
    const key  = s.clubs?.id || 'unknown';
    const name = s.clubs?.name || 'Unknown';
    const abbr = s.clubs?.abbreviation || '?';
    if (!byClub[key]) byClub[key] = { name, abbr, shots: [] };
    byClub[key].shots.push(s);
  });

  const allHits = shots.filter((s) => s.result === 'hit').length;
  const overall = shots.length ? Math.round((allHits / shots.length) * 100) : 0;

  const rows = Object.values(byClub).map(({ abbr, shots: cs }) => {
    const hits = cs.filter((s) => s.result === 'hit').length;
    const pct  = Math.round((hits / cs.length) * 100);
    const tend = missTendency(cs);
    const cls  = pct >= 70 ? 'good' : pct >= 50 ? 'ok' : 'bad';
    return `<tr>
      <td>${abbr}</td>
      <td>${cs.length}</td>
      <td class="${cls}">${pct}%</td>
      <td class="tend">${tend || '—'}</td>
    </tr>`;
  }).join('');

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="screen summary-screen">
      <h1>Session Done</h1>
      <div class="summary-hero">
        <span class="big-number">${overall}%</span>
        <span class="big-label">accuracy</span>
        <span class="big-sub">${shots.length} total shots</span>
      </div>
      <table class="summary-table">
        <thead><tr><th>Club</th><th>Shots</th><th>Hit%</th><th>Miss</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="empty-state">No shots logged</td></tr>'}</tbody>
      </table>
      <textarea id="notes" class="input notes-input" placeholder="Session notes (optional)…" rows="3"></textarea>
      <button class="btn btn-primary btn-block" id="done-btn">Done</button>
    </div>
  `;

  document.getElementById('done-btn').addEventListener('click', async () => {
    const notes = document.getElementById('notes').value.trim();
    if (notes) await endSession(state.activeSession.id, notes, null);
    state.activeSession    = null;
    state.currentClubIndex = 0;
    navigate('home');
  });
}

function currentClub() {
  return state.clubs[state.currentClubIndex];
}
