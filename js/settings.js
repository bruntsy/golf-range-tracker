import { state, navigate, loadUserData } from './app.js';
import { signOut, toggleClub, renameClub } from './supabase.js';

export function renderSettings(container) {
  const active   = state.clubs.filter((c) => c.is_active);
  const all      = state.clubs;

  container.innerHTML = `
    <div class="screen settings-screen">
      <h1>Settings</h1>

      <div class="section">
        <h2 class="section-title">Clubs <span class="section-sub">(tap to rename, toggle to deactivate)</span></h2>
        <div class="clubs-list" id="clubs-list">
          ${all.map(clubRow).join('')}
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">Account</h2>
        <p class="account-email">${state.user?.email}</p>
        <button class="btn btn-ghost btn-block" id="sign-out-btn">Sign Out</button>
      </div>
    </div>
  `;

  // Toggle active/inactive
  container.querySelectorAll('.club-toggle').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id      = btn.dataset.id;
      const current = btn.dataset.active === 'true';
      btn.disabled  = true;
      await toggleClub(id, !current);
      await loadUserData();
      renderSettings(container);
    });
  });

  // Inline rename
  container.querySelectorAll('.club-name-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row  = btn.closest('.club-row');
      const id   = row.dataset.id;
      const club = state.clubs.find((c) => c.id === id);
      if (!club) return;
      renderRenameForm(row, club, container);
    });
  });

  document.getElementById('sign-out-btn').addEventListener('click', async () => {
    await signOut();
    state.user        = null;
    state.clubs       = [];
    state.activeSession = null;
    navigate('auth');
  });
}

function clubRow(club) {
  const activeLabel = club.is_active ? 'Active' : 'Off';
  const toggleCls   = club.is_active ? 'btn-ghost' : 'btn-outline';
  return `
    <div class="club-row" data-id="${club.id}">
      <button class="club-name-btn" title="Tap to rename">
        <span class="club-row-name">${club.name}</span>
        <span class="club-row-abbr">${club.abbreviation}</span>
      </button>
      <button class="btn btn-sm club-toggle ${toggleCls}"
        data-id="${club.id}" data-active="${club.is_active}">
        ${activeLabel}
      </button>
    </div>
  `;
}

function renderRenameForm(row, club, container) {
  const original = row.innerHTML;
  row.innerHTML = `
    <form class="rename-form" id="rename-form-${club.id}">
      <input class="input input-sm" id="rename-name" value="${club.name}" placeholder="Name" required>
      <input class="input input-sm input-abbr" id="rename-abbr" value="${club.abbreviation}" placeholder="Abbr" maxlength="3" required>
      <button type="submit" class="btn btn-sm btn-primary">Save</button>
      <button type="button" class="btn btn-sm btn-ghost" id="cancel-rename">✕</button>
    </form>
  `;

  document.getElementById(`rename-form-${club.id}`).addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('rename-name').value.trim();
    const abbr = document.getElementById('rename-abbr').value.trim().toUpperCase();
    if (!name || !abbr) return;
    await renameClub(club.id, name, abbr);
    await loadUserData();
    renderSettings(container);
  });

  document.getElementById('cancel-rename').addEventListener('click', () => {
    row.innerHTML = original;
    // Re-attach listeners for this row
    row.querySelector('.club-toggle')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id      = club.id;
      const current = club.is_active;
      await toggleClub(id, !current);
      await loadUserData();
      renderSettings(container);
    });
    row.querySelector('.club-name-btn')?.addEventListener('click', () => {
      renderRenameForm(row, club, container);
    });
  });
}
