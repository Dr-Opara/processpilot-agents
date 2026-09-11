-- Migration 0002: OAuth CSRF-state storage, with browser binding.
--
-- This is the ONE confirmed actual production schema change needed for
-- Phase 1's Gmail CSRF fix -- independent inspection of the live database
-- confirmed all 17 other tables referenced by the application already
-- exist with the shape the code expects. oauth_states does not exist yet.
--
-- Required by lib/supabase-server.js's createOAuthState()/
-- verifyAndConsumeOAuthState(), used by api/auth/gmail/start.js and
-- api/auth/gmail/callback.js to close two gaps:
--   1. The Gmail connect flow originally had no state parameter at all, so
--      anyone who requested /api/auth/gmail/start and completed Google's
--      consent screen with any account could have had that account's
--      refresh token stored as ProcessPilot's Gmail integration credential.
--   2. A bare state parameter alone doesn't stop an OAuth-login-CSRF attack:
--      an attacker can complete their OWN consent screen (getting a valid
--      code+state pair) and trick a victim into visiting a crafted callback
--      URL, and pure server-side state validation would accept it, since
--      state+code are both genuinely valid. correlation_hash binds the flow
--      to the browser that started it via an HttpOnly cookie the attacker
--      cannot set in the victim's browser -- see lib/supabase-server.js for
--      the full explanation.
--
-- Review checklist (answers below; do not execute until confirmed):
--   * Additive: yes -- CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT
--     EXISTS only. Nothing existing is touched.
--   * Does not expose OAuth state tokens publicly: RLS is enabled below
--     with zero policies defined, matching the pattern already in place on
--     all 17 existing production tables. With RLS enabled and no policies,
--     PostgREST's anon/authenticated roles get zero rows and zero write
--     access by default. Additionally, correlation_hash stores only a
--     SHA-256 hash of the browser cookie value, never the raw value, so
--     even a leaked row can't be used to forge the cookie.
--   * Service-role server access will work: yes -- lib/supabase-server.js
--     always calls via SUPABASE_SERVICE_ROLE_KEY, and the service role
--     bypasses RLS entirely (Supabase's standard behavior, same as every
--     other table this app already writes through that key).
--   * No anonymous policy permits reading OAuth states: correct -- no
--     policy of any kind is created here, for any role.
--   * Cleanup/expiration: verifyAndConsumeOAuthState() deletes a row the
--     instant it is successfully used (single-use). createOAuthState()
--     additionally deletes that provider's already-expired, never-consumed
--     rows every time a new state is requested (lib/supabase-server.js), so
--     unconsumed/expired rows don't accumulate. Volume is inherently tiny --
--     a new row only on an admin visit to /api/auth/gmail/start.
--
-- Purely additive and idempotent. NOT executed against production from this
-- session -- awaiting your confirmation before it is run.

create table if not exists oauth_states(
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  state text not null,
  correlation_hash text not null, -- sha256 of the HttpOnly browser cookie value; never the raw cookie
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index if not exists oauth_states_provider_state_key on oauth_states(provider, state);
create index if not exists oauth_states_expires on oauth_states(expires_at);

-- Matches the RLS-enabled-with-no-policies posture confirmed on all 17
-- existing production tables (finding #6): locks out anon/authenticated
-- roles by default; service-role access is unaffected.
alter table oauth_states enable row level security;
