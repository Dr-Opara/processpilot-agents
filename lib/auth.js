// Owner authentication via Supabase Auth (GoTrue), called directly over
// REST -- no new npm dependency, consistent with the rest of this codebase.
// Single-tenant simplification: this app has exactly one real user (the
// owner/CEO), so any successfully authenticated Supabase Auth user for this
// project is treated as the owner. If ProcessPilot ever needs multiple
// staff with different permissions, add a `user_roles` table keyed by
// auth.users.id and check it here -- the hook point (getSessionUser) is
// already isolated for that.

const ACCESS_COOKIE = 'pp_session';
const REFRESH_COOKIE = 'pp_refresh';

function authConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase Auth is not configured (SUPABASE_URL / SUPABASE_ANON_KEY)');
  return { url, anonKey };
}

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((p) => p.trim()).filter(Boolean).map((p) => {
    const i = p.indexOf('=');
    return i === -1 ? [p, ''] : [decodeURIComponent(p.slice(0, i)), decodeURIComponent(p.slice(i + 1))];
  }));
}

function cookieHeader(name, value, maxAgeSeconds) {
  const parts = [`${name}=${value}`, 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/'];
  parts.push(`Max-Age=${maxAgeSeconds}`);
  return parts.join('; ');
}

export function clearSessionCookies(res) {
  res.setHeader('Set-Cookie', [
    cookieHeader(ACCESS_COOKIE, '', 0),
    cookieHeader(REFRESH_COOKIE, '', 0),
  ]);
}

export function setSessionCookies(res, { accessToken, refreshToken, expiresIn }) {
  res.setHeader('Set-Cookie', [
    cookieHeader(ACCESS_COOKIE, accessToken, Math.max(60, Number(expiresIn) || 3600)),
    // Refresh tokens in Supabase Auth don't expire on a fixed schedule (they
    // rotate on use); 30 days is a reasonable bound for an internal owner
    // tool -- shorter than that would force annoying re-logins.
    cookieHeader(REFRESH_COOKIE, refreshToken, 60 * 60 * 24 * 30),
  ]);
}

export async function passwordLogin(email, password) {
  const { url, anonKey } = authConfig();
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error_description || data.msg || 'Invalid email or password');
  return data; // { access_token, refresh_token, expires_in, user }
}

async function refreshSession(refreshToken) {
  const { url, anonKey } = authConfig();
  const r = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return null;
  return data;
}

async function verifyAccessToken(accessToken) {
  const { url, anonKey } = authConfig();
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` } });
  if (!r.ok) return null;
  return r.json();
}

// Returns { user, refreshed: {accessToken,refreshToken,expiresIn}|null } or null.
// `refreshed` is non-null when the access token had expired and a valid
// refresh token transparently minted a new one -- the caller (an API route)
// should call setSessionCookies with it so the browser's session extends.
export async function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const accessToken = cookies[ACCESS_COOKIE];
  if (accessToken) {
    const user = await verifyAccessToken(accessToken).catch(() => null);
    if (user) return { user, refreshed: null };
  }
  const refreshToken = cookies[REFRESH_COOKIE];
  if (!refreshToken) return null;
  const refreshed = await refreshSession(refreshToken).catch(() => null);
  if (!refreshed) return null;
  const user = await verifyAccessToken(refreshed.access_token).catch(() => null);
  if (!user) return null;
  return {
    user,
    refreshed: { accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token, expiresIn: refreshed.expires_in },
  };
}

// Combined guard for privileged endpoints: accepts EITHER a valid owner
// session cookie (browser, interactive use -- preferred, gives a real
// actor identity) OR the existing PROCESSPILOT_RUN_SECRET bearer token
// (server-to-server: cron, scheduled cycles, trusted automation). Never
// accept the run secret from a code path that could originate in a browser
// bundle -- it must only ever be read from process.env server-side.
export async function authorizeActor(req, res) {
  const session = await getSessionUser(req).catch(() => null);
  if (session) {
    if (session.refreshed && res) setSessionCookies(res, session.refreshed);
    return { ok: true, actor: { type: 'owner', id: session.user.id, email: session.user.email, displayName: 'Opara' } };
  }
  const secret = process.env.PROCESSPILOT_RUN_SECRET;
  if (secret && req.headers.authorization === `Bearer ${secret}`) {
    return { ok: true, actor: { type: 'automation', id: null, email: null, displayName: 'Automated Runtime' } };
  }
  return { ok: false, actor: null };
}
