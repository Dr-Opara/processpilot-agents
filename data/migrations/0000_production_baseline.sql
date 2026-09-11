-- Migration 0000: production baseline snapshot.
--
-- This is the first entry in the numbered migration history, capturing the
-- schema production already had as of the 2026-09 Phase 1 stabilization
-- (confirmed by direct inspection of the live Supabase project -- 17
-- tables, application code already written against this shape).
--
-- BOOTSTRAP ONLY. This is for provisioning a FRESH environment (local dev,
-- staging, disaster recovery) so it matches production's structure. It must
-- NOT be applied to the existing production database as though production
-- were missing this schema -- production already has it. Every statement is
-- additive (IF NOT EXISTS / ON CONFLICT DO NOTHING), so running it there
-- would be a harmless no-op, but that is not what this file is for.
--
-- This file's DDL is identical to data/schema.sql as of this date -- that
-- file is the maintained, human-readable reference; keep both in sync, or
-- retire this duplication once real migration tooling is adopted. See
-- data/schema.sql's header for the full confirmed-vs-inferred breakdown per
-- table, the RLS posture, and the two tables (agent_state, ui_assets)
-- deliberately left undefined pending introspection.
--
-- The next real, confirmed-necessary migration is 0002_oauth_state.sql
-- (oauth_states does not exist in production yet). There is no 0001 in the
-- runnable sequence -- see data/migrations/superseded/ for why.

create extension if not exists pgcrypto;

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
  naics text,
  set_aside text,
  estimated_value numeric,
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
create unique index if not exists opportunities_source_name_external_id_key
  on opportunities(source_name, external_id);
alter table opportunities enable row level security;

create table if not exists work_packets(
  id uuid primary key default gen_random_uuid(),
  workflow_id text not null,
  opportunity_id uuid references opportunities(id),
  current_agent_id text,
  current_stage text,
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

create table if not exists artifacts(
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id),
  work_packet_id uuid references work_packets(id) on delete cascade,
  agent_run_id uuid,
  artifact_type text,
  title text,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  version integer not null default 1,
  created_at timestamptz not null default now()
);
alter table artifacts enable row level security;

create table if not exists handoffs(
  id uuid primary key default gen_random_uuid(),
  work_packet_id uuid references work_packets(id) on delete cascade,
  from_agent_id text not null,
  to_agent_id text not null,
  artifact_id uuid references artifacts(id),
  created_at timestamptz not null default now()
);
alter table handoffs enable row level security;

create table if not exists approvals(
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id),
  work_packet_id uuid references work_packets(id) on delete cascade,
  requested_by_agent_id text,
  approval_type text,
  title text,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  decision_by text, -- NOT independently confirmed; see data/schema.sql warning
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists approvals_status_type on approvals(status, approval_type);
create index if not exists approvals_work_packet on approvals(work_packet_id);
alter table approvals enable row level security;

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

create table if not exists integration_credentials(
  id uuid primary key default gen_random_uuid(),
  integration_key text unique not null,
  secret_value text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table integration_credentials enable row level security;

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

-- agent_state and ui_assets intentionally omitted -- see data/schema.sql header.
