// Minimal dependency-free History API router for the ProcessPilot shell.
// Matches the project's zero-build, zero-dependency convention -- no
// framework, no bundler. Handlers are `(container, params) => cleanup?`;
// the returned cleanup (if any) runs before the next navigation, so pages
// with polling intervals can stop them cleanly.

const routes = [];
let notFoundHandler = null;
let currentCleanup = null;

export function registerRoute(pattern, handler) {
  const paramNames = [];
  const source = pattern.replace(/:[^/]+/g, (m) => { paramNames.push(m.slice(1)); return '([^/]+)'; });
  routes.push({ regex: new RegExp(`^${source}/?$`), paramNames, handler });
}

export function setNotFound(handler) { notFoundHandler = handler; }

function match(pathname) {
  for (const r of routes) {
    const m = r.regex.exec(pathname);
    if (m) {
      const params = {};
      r.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params };
    }
  }
  return null;
}

function setActiveNav(pathname) {
  const liveOffice = pathname === '/' || pathname === '/live-office';
  document.querySelectorAll('[data-route]').forEach((el) => {
    const href = el.getAttribute('href');
    const active = href === pathname || (liveOffice && href === '/live-office');
    el.classList.toggle('active', active);
  });
}

async function render(pathname) {
  const liveOfficeView = document.getElementById('liveOfficeView');
  const routedView = document.getElementById('routedView');
  const isLiveOffice = pathname === '/' || pathname === '/live-office';

  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (e) { console.error('page cleanup failed', e); }
  }
  currentCleanup = null;

  setActiveNav(pathname);
  liveOfficeView.hidden = !isLiveOffice;
  routedView.hidden = isLiveOffice;

  if (isLiveOffice) return;

  const found = match(pathname) || (notFoundHandler ? { handler: notFoundHandler, params: {} } : null);
  routedView.innerHTML = '<div class="page-loading">Loading…</div>';
  window.scrollTo({ top: 0 });
  if (!found) { routedView.innerHTML = '<div class="page-error"><h2>Page not found.</h2></div>'; return; }
  try {
    const cleanup = await found.handler(routedView, found.params);
    if (typeof cleanup === 'function') currentCleanup = cleanup;
  } catch (e) {
    console.error('page render failed', e);
    routedView.innerHTML = `<div class="page-error"><h2>Something went wrong loading this page.</h2><p>${String(e && e.message || e)}</p><button id="pageRetry" class="btn">Retry</button></div>`;
    const retry = document.getElementById('pageRetry');
    if (retry) retry.onclick = () => render(pathname);
  }
}

export function navigate(pathname, { replace = false } = {}) {
  if (location.pathname === pathname) { render(pathname); return; }
  if (replace) history.replaceState({}, '', pathname); else history.pushState({}, '', pathname);
  render(pathname);
}

export function startRouter() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-route]');
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(a.getAttribute('href'));
  });
  window.addEventListener('popstate', () => render(location.pathname));
  render(location.pathname);
}
