-- Migration 0002: OAuth CSRF-state storage.
--
-- Required by lib/supabase-server.js's createOAuthState()/consumeOAuthState(),
-- used by api/auth/gmail/start.js and api/auth/gmail/callback.js to close a
-- CSRF hole: previously the Gmail connect flow had no state parameter at
-- all, so anyone who requested /api/auth/gmail/start and completed Google's
-- consent screen with any account could have that account's refresh token
-- stored as ProcessPilot's Gmail integration.
--
-- Purely additive and idempotent (CREATE TABLE IF NOT EXISTS). Not run
-- against production from this session -- review and run manually via the
-- Supabase SQL editor alongside 0001_reconcile_runtime_schema.sql.

create table if not exists oauth_states(
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  state text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index if not exists oauth_states_provider_state_key on oauth_states(provider, state);
create index if not exists oauth_states_expires on oauth_states(expires_at);
