let hideTimer = null;
export function toast(message, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.style.background = isError ? '#ff7278' : '#16d9e8';
  el.style.color = isError ? '#2a0608' : '#00151a';
  el.style.opacity = '1';
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { el.style.opacity = '0'; }, 3200);
}
