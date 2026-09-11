-- ProcessPilot Technologies LLC -- canonical schema baseline.
--
-- REWRITTEN 2026-09 (Phase 1 stabilization) to match confirmed LIVE
-- PRODUCTION, after independent inspection established that production
-- already runs the modern schema described here and that the application
-- code was already written against it. The previous version of this file
-- was a stale, pre-production draft; do not resurrect it (git history holds
-- the full record if it's ever needed).
--
-- This file is a snapshot for provisioning a FRESH environment (local dev,
-- staging, disaster recovery) so it creates the same 17-table structure
-- production already has. It must never be run against the existing
-- production database -- every statement is IF NOT EXISTS / additive, so
-- running it there would be a no-op, but that is not its purpose.
-- data/migrations/0000_production_baseline.sql mirrors this file as the
-- first entry in the numbered migration history (BOOTSTRAP / FRESH
-- ENVIRONMENT ONLY -- DO NOT APPLY TO EXISTING PRODUCTION); keep both in
-- sync when the schema changes, and add new NNNN_*.sql files for anything
-- beyond this baseline (0002_oauth_state.sql is the first such addition).
--
-- All 17 production tables are now defined below with independently
-- confirmed column definitions: opportunities, work_packets, artifacts,
-- handoffs, approvals, agent_runs, activity_events, source_registry,
-- integration_status, integration_credentials, company_knowledge,
-- document_templates, outreach_prospects, opportunity_documents,
-- runtime_failures, agent_state, ui_assets. A few data types on
-- opportunities (naics, set_aside, estimated_value) and the exact
-- work_packets.status CHECK constraint (if any) remain reasonable
-- inferences rather than byte-for-byte confirmed -- flagged inline where
-- that's the case.
--
-- RLS: production has Row Level Security ENABLED on every one of its 17
-- tables, with NO policies defined on any of them. All application access
-- goes through the Supabase service-role key, which bypasses RLS entirely --
-- so RLS-enabled-with-no-policies simply means the anon/authenticated roles
-- get zero access by default. This file reproduces that posture for every
-- table it defines. Do not disable RLS and do not add a permissive policy
-- without deliberately deciding which role that policy is for.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- opportunities
-- ---------------------------------------------------------------------------
create table if not exists opportunities(
  id uuid primary key default gen_random_uuid(),
  source_name text,
  external_id text,
  source_url text not null,
  jurisdiction text not null,
  agency text,
  title text not null,
  description text,
  solicitation_type text,
  naics text,               -- inferred type; confirmed to exist, exact type not verified
  set_aside text,           -- inferred type; confirmed to exist, exact type not verified
  estimated_value numeric,  -- inferred type; confirmed to exist, exact type not verified
  posted_at timestamptz,
  questions_due_at timestamptz,
  response_due_at timestamptz,
  status text not null default 'discovered',
  fit_score numeric,
  fit_rationale text,
  risk_flags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Production currently has TWO equivalent unique indexes on
-- (source_name, external_id) (confirmed low-priority cleanup item -- do not
-- drop either one in production until every dependency is checked). A fresh
-- environment only needs one.
create unique index if not exists opportunities_source_name_external_id_key
  on opportunities(source_name, external_id);
alter table opportunities enable row level security;

-- ---------------------------------------------------------------------------
-- work_packets
-- ---------------------------------------------------------------------------
create table if not exists work_packets(
  id uuid primary key default gen_random_uuid(),
  workflow_id text not null,
  opportunity_id uuid references opportunities(id),
  current_agent_id text,
  current_stage text,
  -- Confirmed values in live use include at least 'queued' and
  -- 'waiting_approval' (all 3 current production work packets are
  -- waiting_approval). The exact full CHECK constraint production enforces,
  -- if any, was not independently confirmed -- deliberately left
  -- unconstrained here rather than guessing a set that might not match.
  status text not null default 'queued',
  priority integer not null default 50,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists work_packets_stage_status on work_packets(current_stage, status);
alter table work_packets enable row level security;

-- ---------------------------------------------------------------------------
-- artifacts
-- ---------------------------------------------------------------------------
create table if not exists artifacts(
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id),
  work_packet_id uuid references work_packets(id) on delete cascade,
  agent_run_id uuid,
  artifact_type text,
  title text,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  version integer not null default 1, -- confirmed to exist; type inferred
  created_at timestamptz not null default now()
);
alter table artifacts enable row level security;

-- ---------------------------------------------------------------------------
-- handoffs
-- ---------------------------------------------------------------------------
create table if not exists handoffs(
  id uuid primary key default gen_random_uuid(),
  work_packet_id uuid references work_packets(id) on delete cascade,
  from_agent_id text not null,
  to_agent_id text not null,
  artifact_id uuid references artifacts(id),
  created_at timestamptz not null default now()
);
alter table handoffs enable row level security;

-- ---------------------------------------------------------------------------
-- approvals -- exact production definition, independently confirmed
-- ---------------------------------------------------------------------------
create table if not exists approvals(
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id) on delete cascade,
  work_packet_id uuid references work_packets(id) on delete set null,
  requested_by_agent_id text not null,
  approval_type text not null,
  title text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','approved','declined','returned','expired')),
  decision_by text,
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists approvals_status_idx on approvals(status, created_at desc);
alter table approvals enable row level security;

-- ---------------------------------------------------------------------------
-- agent_runs
-- ---------------------------------------------------------------------------
create table if not exists agent_runs(
  id uuid primary key default gen_random_uuid(),
  work_packet_id uuid references work_packets(id) on delete cascade,
  opportunity_id uuid references opportunities(id),
  agent_id text not null,
  department text,
  status text not null default 'running',
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  model text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agent_runs_agent_status on agent_runs(agent_id, status);
create index if not exists agent_runs_started on agent_runs(started_at desc);
alter table agent_runs enable row level security;

-- ---------------------------------------------------------------------------
-- activity_events (production's actual event log table -- not agent_events)
-- ---------------------------------------------------------------------------
create table if not exists activity_events(
  id bigserial primary key,
  agent_id text not null,
  event_type text not null,
  message text not null,
  severity text not null default 'info',
  verified boolean not null default false,
  source jsonb,
  opportunity_id uuid references opportunities(id),
  work_packet_id uuid references work_packets(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_events_created on activity_events(created_at desc);
create index if not exists activity_events_type on activity_events(event_type);
create index if not exists activity_events_metadata_gin on activity_events using gin(metadata);
alter table activity_events enable row level security;

-- ---------------------------------------------------------------------------
-- source_registry (seeded with only the 4 in-scope TX/DC/MD/VA sources --
-- no SAM.gov / federal rows, matching lib/sources.js and the confirmed
-- production row count of 4)
-- ---------------------------------------------------------------------------
create table if not exists source_registry(
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text,
  jurisdiction text,
  url text,
  market text,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into source_registry (code, name, jurisdiction, url, market)
values
  ('tx_esbd', 'Texas ESBD', 'TX', 'https://www.txsmartbuy.gov/esbd', 'state'),
  ('dc_ocp', 'DC Office of Contracting and Procurement', 'DC', 'https://ocp.dc.gov', 'local'),
  ('md_emma', 'Maryland eMMA', 'MD', 'https://emma.maryland.gov', 'state'),
  ('va_eva', 'Virginia eVA', 'VA', 'https://eva.virginia.gov', 'state')
on conflict (code) do nothing;
alter table source_registry enable row level security;

-- ---------------------------------------------------------------------------
-- integration_status
-- ---------------------------------------------------------------------------
create table if not exists integration_status(
  id uuid primary key default gen_random_uuid(),
  integration_key text unique not null,
  display_name text,
  status text not null default 'waiting',
  detail text,
  last_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table integration_status enable row level security;

-- ---------------------------------------------------------------------------
-- integration_credentials -- service-role only. secret_value is currently
-- stored without application-level encryption (confirmed finding); do not
-- expose this table through any public route or the anon key. See
-- data/migrations/PROPOSED_credential_encryption.md for a reviewed-not-
-- executed plan to migrate this to Supabase Vault.
-- ---------------------------------------------------------------------------
create table if not exists integration_credentials(
  id uuid primary key default gen_random_uuid(),
  integration_key text unique not null,
  secret_value text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table integration_credentials enable row level security;

-- ---------------------------------------------------------------------------
-- company_knowledge / document_templates
-- ---------------------------------------------------------------------------
create table if not exists company_knowledge(
  id uuid primary key default gen_random_uuid(),
  knowledge_key text unique,
  category text,
  title text,
  content jsonb not null default '{}'::jsonb,
  approved_for_external_use boolean not null default false,
  source_document text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table company_knowledge enable row level security;

create table if not exists document_templates(
  id uuid primary key default gen_random_uuid(),
  template_key text unique,
  category text,
  title text,
  body text,
  external_use_allowed boolean not null default false,
  human_approval_required boolean not null default true,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table document_templates enable row level security;

-- ---------------------------------------------------------------------------
-- outreach_prospects
-- ---------------------------------------------------------------------------
create table if not exists outreach_prospects(
  id uuid primary key default gen_random_uuid(),
  organization text not null,
  contact_name text,
  contact_title text,
  email text unique not null,
  source_url text not null,
  source_type text,
  relevance_reason text,
  market text not null default 'commercial',
  status text not null default 'new',
  metadata jsonb not null default '{}'::jsonb,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists outreach_prospects_status on outreach_prospects(status);
alter table outreach_prospects enable row level security;

-- ---------------------------------------------------------------------------
-- opportunity_documents
-- ---------------------------------------------------------------------------
create table if not exists opportunity_documents(
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id) on delete cascade,
  source_type text,
  gmail_message_id text,
  gmail_attachment_id text,
  filename text,
  mime_type text,
  content_text text,
  content_hash text,
  status text not null default 'captured',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(opportunity_id, content_hash)
);
alter table opportunity_documents enable row level security;

-- ---------------------------------------------------------------------------
-- runtime_failures
-- ---------------------------------------------------------------------------
create table if not exists runtime_failures(
  id uuid primary key default gen_random_uuid(),
  work_packet_id uuid references work_packets(id),
  opportunity_id uuid references opportunities(id),
  agent_id text,
  operation text,
  error text,
  attempt integer not null default 1,
  status text not null default 'open',
  next_retry_at timestamptz,
  created_at timestamptz not null default now()
);
alter table runtime_failures enable row level security;

-- ---------------------------------------------------------------------------
-- agent_state -- exact production definition, independently confirmed.
-- NOTE: no code in this repository currently reads or writes this table --
-- api/status.js computes agentStates in memory from work_packets/department
-- readiness instead of reading here. The schema already supports a
-- persisted per-agent runtime status (ready/working/waiting/blocked/error/
-- paused); wiring the runtime to actually use this table is a reasonable
-- Phase 4 candidate, not done as part of this schema reconciliation.
-- ---------------------------------------------------------------------------
create table if not exists agent_state(
  agent_id text primary key,
  department text not null,
  runtime_status text not null default 'waiting'
    check (runtime_status in ('ready','working','waiting','blocked','error','paused')),
  current_work_packet_id uuid references work_packets(id) on delete set null,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table agent_state enable row level security;

-- ---------------------------------------------------------------------------
-- ui_assets -- exact production definition, independently confirmed.
-- NOTE: no code in this repository currently reads or writes this table.
-- Its shape (mime_type/content_b64/sha256/byte_size keyed by asset_key)
-- strongly resembles a DB-backed successor to the now-deleted
-- api/assets/command-center.js image-serving endpoint (removed in Phase 1
-- as unused/obsolete -- see git history). Left unwired deliberately; no
-- Phase 1 code path uses it.
-- ---------------------------------------------------------------------------
create table if not exists ui_assets(
  asset_key text primary key,
  mime_type text not null,
  content_b64 text not null default '',
  sha256 text,
  byte_size integer,
  updated_at timestamptz not null default now()
);
alter table ui_assets enable row level security;
