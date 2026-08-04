(() => {
  'use strict';

  const form = document.getElementById('loginForm');
  const note = document.getElementById('loginNote');

  // If already signed in, skip straight to the dashboard.
  fetch('/api/admin/me', { credentials: 'same-origin' })
    .then((r) => (r.ok ? (window.location.href = '/admin/') : null))
    .catch(() => {});

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelectorAll('[data-field]').forEach((f) => f.classList.remove('has-error'));
    note.textContent = '';
    note.className = 'form-note';

    const btn = form.querySelector('button[type="submit"]');
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    btn.disabled = true;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        note.textContent = body.error || 'Sign in failed.';
        note.className = 'form-note error';
        return;
      }
      window.location.href = '/admin/';
    } catch {
      note.textContent = 'Could not reach the server. Please try again.';
      note.className = 'form-note error';
    } finally {
      btn.disabled = false;
    }
  });
})();
