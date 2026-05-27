import { signInWithEmail } from './supabase.js';

export function renderAuth(container) {
  container.innerHTML = `
    <div class="screen auth-screen">
      <div class="auth-logo">⛳</div>
      <h1 class="auth-title">Range Tracker</h1>
      <p class="auth-subtitle">Log every shot. Find your pattern.</p>
      <form id="auth-form" class="auth-form">
        <input
          type="email"
          id="email-input"
          class="input"
          placeholder="your@email.com"
          autocomplete="email"
          required
        />
        <button type="submit" class="btn btn-primary btn-block">Send Magic Link</button>
      </form>
      <div id="auth-message" class="hidden"></div>
    </div>
  `;

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email-input').value.trim();
    const btn   = e.target.querySelector('button');

    btn.textContent = 'Sending…';
    btn.disabled    = true;

    const { error } = await signInWithEmail(email);
    const msg = document.getElementById('auth-message');
    msg.classList.remove('hidden', 'auth-success', 'auth-error');

    if (error) {
      msg.classList.add('auth-error');
      msg.textContent = error.message;
      btn.textContent = 'Send Magic Link';
      btn.disabled    = false;
    } else {
      msg.classList.add('auth-success');
      msg.textContent = `Check ${email} — magic link on its way!`;
      document.getElementById('auth-form').classList.add('hidden');
    }
  });
}
