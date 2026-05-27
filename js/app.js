import { supabase, getClubs, seedClubs, insertShot } from './supabase.js';
import { initOfflineDB, flushQueue, getQueueCount } from './offline.js';

export const state = {
  user:              null,
  clubs:             [],
  activeSession:     null,
  currentClubIndex:  0,
};

export function navigate(route) {
  history.pushState(null, '', location.pathname + '#' + route);
  render(route);
}

let _loadingUserData = false;
export async function loadUserData() {
  if (_loadingUserData) return;
  _loadingUserData = true;
  try {
    let { data: clubs } = await getClubs(state.user.id);
    if (!clubs || clubs.length === 0) {
      await seedClubs(state.user.id);
      ({ data: clubs } = await getClubs(state.user.id));
    }
    state.clubs = (clubs || []).filter((c) => c.is_active);
  } finally {
    _loadingUserData = false;
  }
}

async function render(route) {
  const app = document.getElementById('app');
  const nav = document.getElementById('bottom-nav');

  const noNav = ['auth', 'session'].includes(route);
  nav.classList.toggle('hidden', noNav);
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.route === route);
  });

  switch (route) {
    case 'auth': {
      const { renderAuth } = await import('./auth.js');
      renderAuth(app);
      break;
    }
    case 'home': {
      const { renderHome } = await import('./home.js');
      await renderHome(app);
      break;
    }
    case 'session': {
      const { renderSession } = await import('./session.js');
      renderSession(app);
      break;
    }
    case 'analysis': {
      const { renderAnalysis } = await import('./analysis.js');
      await renderAnalysis(app);
      break;
    }
    case 'settings': {
      const { renderSettings } = await import('./settings.js');
      renderSettings(app);
      break;
    }
    default:
      render(state.user ? 'home' : 'auth');
  }
}

async function syncOfflineShots() {
  const count = await getQueueCount();
  if (count === 0) return;
  try {
    const synced = await flushQueue(insertShot);
    if (synced > 0) console.log(`Synced ${synced} offline shots`);
  } catch (e) {
    console.warn('Offline sync failed', e);
  }
}

async function init() {
  await initOfflineDB();

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'SYNC_SHOTS') syncOfflineShots();
      });
    } catch (_) {}
  }

  window.addEventListener('online', syncOfflineShots);

  document.getElementById('bottom-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (btn) navigate(btn.dataset.route);
  });

  window.addEventListener('popstate', () => {
    const hash = location.hash.slice(1);
    if (!hash.startsWith('access_token') && !hash.startsWith('error=')) {
      render(hash || 'home');
    }
  });

  supabase.auth.onAuthStateChange(async (event, session) => {
    const hash       = location.hash.slice(1);
    const isMagicLink = hash.startsWith('access_token') || hash.startsWith('error=');

    if (event === 'INITIAL_SESSION') {
      if (session) {
        state.user = session.user;
        await loadUserData();
        const safeRoutes = ['home', 'analysis', 'settings'];
        render(safeRoutes.includes(hash) ? hash : 'home');
        syncOfflineShots();
      } else if (!isMagicLink) {
        render('auth');
      }
      // If isMagicLink with no session yet — wait for SIGNED_IN below
    } else if (event === 'SIGNED_IN' && session) {
      state.user = session.user;
      await loadUserData();
      history.replaceState(null, '', location.pathname + '#home');
      await render('home');
      syncOfflineShots();
    } else if (event === 'SIGNED_OUT') {
      state.user = null;
      state.clubs = [];
      state.activeSession = null;
      history.replaceState(null, '', location.pathname + '#auth');
      render('auth');
    }
  });
}

init().catch(console.error);
