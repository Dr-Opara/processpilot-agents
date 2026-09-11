const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');
const submitBtn = document.getElementById('submitBtn');

function paramReturnTo() {
  const p = new URLSearchParams(location.search).get('return_to');
  return p && p.startsWith('/') ? p : '/live-office';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in…';
  try {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Sign-in failed');
    location.href = paramReturnTo();
  } catch (err) {
    errorEl.textContent = err.message || 'Sign-in failed';
    errorEl.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign in';
  }
});
