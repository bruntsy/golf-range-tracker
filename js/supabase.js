import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
  document.getElementById('app').innerHTML = `
    <div class="config-error">
      <h2>Setup Required</h2>
      <p>Open <code>js/config.js</code> and add your Supabase URL and anon key.</p>
      <p>See comments in that file for full setup instructions.</p>
    </div>`;
  throw new Error('Supabase not configured');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const getSession = () =>
  supabase.auth.getSession().then((r) => r.data.session);

export const signInWithEmail = (email) =>
  supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });

export const signOut = () => supabase.auth.signOut();

// ── Clubs ─────────────────────────────────────────────────────────────────────

export const getClubs = (userId) =>
  supabase
    .from('clubs')
    .select('*')
    .eq('user_id', userId)
    .order('order_index');

export const seedClubs = (userId) => {
  const defaults = [
    { name: 'Driver',        abbreviation: 'DR', type: 'driver'  },
    { name: '3 Wood',        abbreviation: '3W', type: 'wood'    },
    { name: '5 Wood',        abbreviation: '5W', type: 'wood'    },
    { name: '4 Hybrid',      abbreviation: '4H', type: 'hybrid'  },
    { name: '4 Iron',        abbreviation: '4I', type: 'iron'    },
    { name: '5 Iron',        abbreviation: '5I', type: 'iron'    },
    { name: '6 Iron',        abbreviation: '6I', type: 'iron'    },
    { name: '7 Iron',        abbreviation: '7I', type: 'iron'    },
    { name: '8 Iron',        abbreviation: '8I', type: 'iron'    },
    { name: '9 Iron',        abbreviation: '9I', type: 'iron'    },
    { name: 'Pitching Wedge',abbreviation: 'PW', type: 'wedge'   },
    { name: 'Gap Wedge',     abbreviation: 'GW', type: 'wedge'   },
    { name: 'Sand Wedge',    abbreviation: 'SW', type: 'wedge'   },
    { name: 'Lob Wedge',     abbreviation: 'LW', type: 'wedge'   },
  ].map((c, i) => ({ ...c, user_id: userId, order_index: i, is_active: true }));

  return supabase.from('clubs').insert(defaults);
};

export const toggleClub = (id, isActive) =>
  supabase.from('clubs').update({ is_active: isActive }).eq('id', id);

export const renameClub = (id, name, abbreviation) =>
  supabase.from('clubs').update({ name, abbreviation }).eq('id', id);

export const updateClubOrder = (updates) =>
  Promise.all(
    updates.map(({ id, order_index }) =>
      supabase.from('clubs').update({ order_index }).eq('id', id)
    )
  );

// ── Sessions ──────────────────────────────────────────────────────────────────

export const createSession = (userId) =>
  supabase.from('sessions').insert({ user_id: userId }).select().single();

export const endSession = (id, notes, ballCount) =>
  supabase.from('sessions').update({
    ended_at: new Date().toISOString(),
    ...(notes !== null && { notes }),
    ...(ballCount !== null && { ball_count: ballCount }),
  }).eq('id', id);

export const getRecentSessions = (userId, limit = 20) =>
  supabase
    .from('sessions')
    .select('*, shots(*, clubs(*))')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit);

// ── Shots ─────────────────────────────────────────────────────────────────────

export const insertShot = (sessionId, clubId, result, shotNumber) =>
  supabase.from('shots').insert({
    session_id: sessionId,
    club_id: clubId,
    result,
    shot_number: shotNumber,
  });

export const undoShot = (sessionId, shotNumber) =>
  supabase.from('shots').delete()
    .eq('session_id', sessionId)
    .eq('shot_number', shotNumber);
