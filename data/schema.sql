-- NOTE (Phase 1 stabilization, 2026-09): this file reflects only the original
-- baseline tables. It undercounts what the application actually requires --
-- see data/migrations/0001_reconcile_runtime_schema.sql for the additive
-- migration that reconciles this baseline with what lib/db.js, lib/agent-
-- runner.js and the API routes actually read/write (agent_runs,
-- integration_status, integration_credentials, company_knowledge,
-- document_templates, outreach_prospects, source_registry,
-- opportunity_documents, runtime_failures, and activity_events). Treat this
-- file as the historical baseline and data/migrations/ as the current source
-- of truth going forward.
create extension if not exists pgcrypto;
create table if not exists opportunities(id uuid primary key default gen_random_uuid(), jurisdiction text not null, title text not null, agency text, source_url text not null, solicitation_number text, due_at timestamptz, value_estimate numeric, fit_score numeric, stage text not null default 'discovered', raw jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index if not exists opportunities_source_unique on opportunities(source_url);
create table if not exists work_packets(id uuid primary key default gen_random_uuid(), workflow_id text not null, opportunity_id uuid references opportunities(id), assigned_agent_id text not null, status text not null check(status in('queued','working','waiting','awaiting_approval','blocked','completed','failed')), input jsonb not null default '{}'::jsonb, source jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists artifacts(id uuid primary key default gen_random_uuid(), work_packet_id uuid references work_packets(id) on delete cascade, agent_id text not null, type text not null, title text not null, content jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists handoffs(id uuid primary key default gen_random_uuid(), work_packet_id uuid references work_packets(id) on delete cascade, from_agent_id text not null, to_agent_id text not null, artifact_id uuid references artifacts(id), created_at timestamptz not null default now());
create table if not exists approvals(id uuid primary key default gen_random_uuid(), work_packet_id uuid references work_packets(id) on delete cascade, action text not null, reason text not null, status text not null default 'pending' check(status in('pending','approved','returned','declined')), decided_by text, requested_at timestamptz not null default now(), decided_at timestamptz);
create table if not exists agent_events(id bigserial primary key, agent_id text not null, work_packet_id uuid references work_packets(id), event_type text not null, message text not null, source jsonb, verified boolean not null default false, created_at timestamptz not null default now());
create index if not exists work_packets_agent_status on work_packets(assigned_agent_id,status);
create index if not exists agent_events_created on agent_events(created_at desc);
create index if not exists approvals_status on approvals(status);
