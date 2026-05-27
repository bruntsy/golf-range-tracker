import { supabase } from './supabase.js';

export function renderAuth(container) {
  container.innerHTML = `
    <div class="screen auth-screen">
      <div class="auth-logo">⛳</div>
      <h1 class="auth-title">Range Tracker</h1>
      <p class="auth-subtitle">Log every shot. Find your pattern.</p>

      <div class="auth-tabs">
        <button class="auth-tab active" data-mode="signin">Sign In</button>
        <button class="auth-tab" data-mode="signup">Create Account</button>
      </div>

      <form id="auth-form" class="auth-form">
        <input type="email"    id="auth-email"    class="input" placeholder="Email"    autocomplete="email"    required />
        <input type="password" id="auth-password" class="input" placeholder="Password" autocomplete="current-password" required minlength="6" />
        <button type="submit" class="btn btn-primary btn-block" id="auth-btn">Sign In</button>
      </form>

      <button class="btn-link" id="reset-btn">Forgot password?</button>
      <div id="auth-message" class="hidden"></div>
    </div>
  `;

  let mode = 'signin';

  container.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      mode = tab.dataset.mode;
      container.querySelectorAll('.auth-tab').forEach((t) =>
        t.classList.toggle('active', t.dataset.mode === mode)
      );
      document.getElementById('auth-btn').textContent = mode === 'signin' ? 'Sign In' : 'Create Account';
      document.getElementById('auth-password').autocomplete =
        mode === 'signin' ? 'current-password' : 'new-password';
      document.getElementById('auth-message').classList.add('hidden');
    });
  });

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const btn      = document.getElementById('auth-btn');
    const msg      = document.getElementById('auth-message');

    btn.textContent = 'Loading…';
    btn.disabled    = true;
    msg.classList.add('hidden');

    const { error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      msg.className   = 'auth-error';
      msg.textContent = error.message;
      btn.textContent = mode === 'signin' ? 'Sign In' : 'Create Account';
      btn.disabled    = false;
    } else if (mode === 'signup') {
      msg.className   = 'auth-success';
      msg.textContent = 'Account created! Check your email to confirm, then sign in.';
      btn.textContent = 'Create Account';
      btn.disabled    = false;
    }
    // On successful signin, onAuthStateChange in app.js handles navigation
  });

  document.getElementById('reset-btn').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const msg   = document.getElementById('auth-message');
    if (!email) {
      msg.className   = 'auth-error';
      msg.textContent = 'Enter your email above first.';
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    msg.className   = error ? 'auth-error' : 'auth-success';
    msg.textContent = error ? error.message : `Password reset email sent to ${email}`;
  });
}
