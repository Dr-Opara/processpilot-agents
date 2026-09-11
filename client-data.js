// Shared read-only data access for all routed pages. Every function hits a
// real API route -- nothing here fabricates data. A very short TTL cache
// (2s) just dedupes near-simultaneous calls when several widgets on the same
// page ask for the same resource; it is not meant to mask staleness.

const cache = new Map();
const TTL_MS = 2000;

async function cachedJson(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = fetch(url, { cache: 'no-store' }).then(async (r) => {
    if (!r.ok) {
      let detail = '';
      try { detail = (await r.json()).error || ''; } catch {}
      throw new Error(detail || `${url} failed (${r.status})`);
    }
    return r.json();
  });
  cache.set(url, { at: Date.now(), promise });
  return promise;
}

export const getAgentsRegistry = () => cachedJson('/data/agents.json');
export const getJurisdictions = () => cachedJson('/data/jurisdictions.json');
export const getStatus = () => cachedJson('/api/status');
export const getOpportunities = () => cachedJson('/api/opportunities').then((d) => d.opportunities || []);
export const getWorkPackets = () => cachedJson('/api/work').then((d) => d.work || []);
export const getApprovals = () => cachedJson('/api/approvals').then((d) => d.approvals || []);
export const getEvents = () => cachedJson('/api/events').then((d) => d.events || []);
export const getSources = () => cachedJson('/api/sources').then((d) => d.sources || []);
export const getOutreachProspects = () => cachedJson('/api/outreach/prospects').then((d) => d.prospects || []);
export const getArtifacts = (opportunityId) => cachedJson(`/api/artifacts${opportunityId ? `?opportunity_id=${encodeURIComponent(opportunityId)}` : ''}`).then((d) => d.artifacts || []);
export const getAgentRuns = (opportunityId) => cachedJson(`/api/agent-runs${opportunityId ? `?opportunity_id=${encodeURIComponent(opportunityId)}` : ''}`).then((d) => d.runs || []);

export async function getOpportunityById(id) {
  const all = await getOpportunities();
  return all.find((o) => o.id === id) || null;
}
export async function getWorkPacketById(id) {
  const all = await getWorkPackets();
  return all.find((w) => w.id === id) || null;
}
export async function getAgentById(id) {
  const registry = await getAgentsRegistry();
  return (registry.agents || []).find((a) => a.id === id) || null;
}

export function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.valueOf())) return '—';
  return d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' });
}
export function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.valueOf())) return '—';
  return d.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function fmtMoney(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
export function statusPillClass(status = '') {
  return `status-pill pill-${String(status).toLowerCase().replace(/\s+/g, '_')}`;
}
export function statusLabel(status = '') {
  return String(status).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Every workspace built on top of the gated data endpoints (opportunities,
// work packets, approvals, events, sources) needs the same "sign in to
// continue" fallback when the owner isn't authenticated -- centralized here
// so it stays consistent and each page module doesn't reinvent it.
export function isSignInError(e) {
  return e && /sign in required/i.test(e.message || '');
}
export function signInGateHtml(message = 'Sign in as the ProcessPilot owner to view this workspace.') {
  return `<div class="auth-gate"><p>${esc(message)}</p><a class="btn btn-approve" href="/login.html?return_to=${encodeURIComponent(location.pathname)}">Sign in</a></div>`;
}
