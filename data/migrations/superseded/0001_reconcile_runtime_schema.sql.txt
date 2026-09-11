-- Migration 0001: reconcile production schema with what the application code
-- actually reads and writes.
--
-- WHY THIS EXISTS
-- data/schema.sql only ever defined opportunities, work_packets, artifacts,
-- handoffs, approvals, agent_events. The live application (lib/db.js,
-- lib/agent-runner.js, lib/portal-collector.js, lib/source-health.js,
-- lib/supabase-server.js, lib/gmail-intake.js, api/status.js and friends)
-- reads/writes several tables and columns that were never defined anywhere
-- in this repository: agent_runs, integration_status, integration_credentials,
-- company_knowledge, document_templates, outreach_prospects, source_registry,
-- opportunity_documents, runtime_failures, and a table named activity_events
-- (schema.sql only ever created agent_events, a different name).
--
-- SAFETY
-- Every statement below is additive and idempotent:
--   * CREATE TABLE IF NOT EXISTS  -- never touches a table that already exists
--   * ALTER TABLE ... ADD COLUMN IF NOT EXISTS  -- never drops/alters existing columns
--   * CREATE INDEX IF NOT EXISTS
--   * the one CHECK constraint change (work_packets.status) replaces the
--     constraint with a strict superset of the original allowed values, so
--     no existing row can violate it
-- Nothing here drops a table, drops a column, truncates, or deletes rows.
-- No table that already exists in your live project (agent_events included)
-- is touched, renamed, or removed by this file.
--
-- HOW TO RUN
-- Paste this file into the Supabase SQL editor for the processpilot-agents
-- project and run it once. It is safe to run more than once (idempotent).
-- This was NOT executed against production from this session — no
-- Supabase credentials were available here. Review before running.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- opportunities: add the columns the app actually writes/reads
-- ---------------------------------------------------------------------------
alter table opportunities add column if not exists source_name text;
alter table opportunities add column if not exists external_id text;
alter table opportunities add column if not exists description text;
alter table opportunities add column if not exists solicitation_type text;
alter table opportunities add column if not exists posted_at timestamptz;
alter table opportunities add column if not exists questions_due_at timestamptz;
alter table opportunities add column if not exists response_due_at timestamptz;
alter table opportunities add column if not exists status text not null default 'discovered';
alter table opportunities add column if not exists risk_flags jsonb not null default '[]'::jsonb;
alter table opportunities add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table opportunities add column if not exists fit_rationale text;

-- upsertOpportunity() upserts on (source_name, external_id); every insert
-- path in the code supplies both, so this is safe to add now. Existing rows
-- (created before this migration) get NULL in both columns, and Postgres
-- treats each NULL pair as distinct, so this cannot collide with them.
create unique index if not exists opportunities_source_name_external_id_key
  on opportunities(source_name, external_id);

-- ---------------------------------------------------------------------------
-- work_packets: add the columns the app actually writes/reads, and widen the
-- status check constraint to a superset that also covers the values the code
-- uses today (running / waiting_input / waiting_approval) alongside the
-- original values, so nothing already stored becomes invalid.
-- ---------------------------------------------------------------------------
alter table work_packets add column if not exists current_agent_id text;
alter table work_packets add column if not exists current_stage text;
alter table work_packets add column if not exists priority integer not null default 50;
alter table work_packets add column if not exists started_at timestamptz;
alter table work_packets add column if not exists completed_at timestamptz;
alter table work_packets add column if not exists output jsonb not null default '{}'::jsonb;
alter table work_packets add column if not exists error text;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'work_packets_status_check'
      and conrelid = 'work_packets'::regclass
  ) then
    alter table work_packets drop constraint work_packets_status_check;
  end if;
  alter table work_packets add constraint work_packets_status_check
    check (status in (
      'queued','running','working','waiting','waiting_input',
      'waiting_approval','awaiting_approval','blocked','completed','failed'
    ));
end $$;

create index if not exists work_packets_stage_status on work_packets(current_stage, status);

-- ---------------------------------------------------------------------------
-- artifacts: add the columns the app actually writes/reads
-- ---------------------------------------------------------------------------
alter table artifacts add column if not exists opportunity_id uuid references opportunities(id);
alter table artifacts add column if not exists agent_run_id uuid;
alter table artifacts add column if not exists artifact_type text;
alter table artifacts add column if not exists status text not null default 'draft';

-- ---------------------------------------------------------------------------
-- approvals: add the columns the app actually writes/reads (kept alongside
-- the original action/reason/decided_by columns rather than replacing them)
-- ---------------------------------------------------------------------------
alter table approvals add column if not exists opportunity_id uuid references opportunities(id);
alter table approvals add column if not exists requested_by_agent_id text;
alter table approvals add column if not exists approval_type text;
alter table approvals add column if not exists title text;
alter table approvals add column if not exists summary text;
alter table approvals add column if not exists payload jsonb not null default '{}'::jsonb;
alter table approvals add column if not exists decision_by text;
alter table approvals add column if not exists decision_note text;

create index if not exists approvals_status_type on approvals(status, approval_type);
create index if not exists approvals_work_packet on approvals(work_packet_id);

-- ---------------------------------------------------------------------------
-- agent_runs: entirely new table, required by lib/agent-runner.js and
-- api/status.js. Does not touch/replace agent_events.
-- ---------------------------------------------------------------------------
create table if not exists agent_runs(
  id uuid primary key default gen_random_uuid(),
  work_packet_id uuid references work_packets(id) on delete cascade,
  opportunity_id uuid references opportunities(id),
  agent_id text not null,
  department text,
  status text not null default 'running' check (status in ('running','completed','failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  model text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agent_runs_agent_status on agent_runs(agent_id, status);
create index if not exists agent_runs_started on agent_runs(started_at desc);

-- ---------------------------------------------------------------------------
-- activity_events: entirely new table. This is a NEW table, not a rename of
-- agent_events -- agent_events (if it exists in your project) is left
-- completely untouched by this migration.
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

-- ---------------------------------------------------------------------------
-- source_registry: entirely new table, required by lib/portal-collector.js
-- and lib/source-health.js. Seeded with the four in-scope TX/DC/MD/VA
-- sources defined in lib/sources.js -- no SAM.gov / federal rows.
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

-- ---------------------------------------------------------------------------
-- integration_status: entirely new table, required by api/status.js,
-- lib/supabase-server.js, lib/portal-collector.js, lib/source-health.js.
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

-- ---------------------------------------------------------------------------
-- integration_credentials: entirely new table, required by
-- lib/supabase-server.js (stores the Gmail OAuth refresh token server-side).
-- Access to this table must remain service-role only; never expose it
-- through a public API route or the anon key.
-- ---------------------------------------------------------------------------
create table if not exists integration_credentials(
  id uuid primary key default gen_random_uuid(),
  integration_key text unique not null,
  secret_value text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- company_knowledge / document_templates: entirely new tables, required by
-- lib/db.js (listCompanyKnowledge / listDocumentTemplates) and consumed by
-- the agent runtime + outreach drafting as the only approved source of
-- external-facing company facts and templates.
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

-- ---------------------------------------------------------------------------
-- outreach_prospects: entirely new table, required by lib/db.js and
-- api/outreach/*.js.
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

-- ---------------------------------------------------------------------------
-- opportunity_documents: entirely new table, required by lib/gmail-intake.js
-- (captureAttachments).
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

-- ---------------------------------------------------------------------------
-- runtime_failures: entirely new table, required by lib/agent-runner.js's
-- failure path.
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
