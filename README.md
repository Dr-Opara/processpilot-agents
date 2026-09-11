# ProcessPilot Technologies LLC — Agentic Employees

Standalone AI-workforce application. This repository does **not** replace ProcessPilotTech.com.

## Operating model

The application models 30 specialized agents across Opportunity Intelligence, Procurement Operations, Vendor Research, Proposal Studio, Compliance & Risk, Pricing & Finance, Outreach, Contracts & Delivery, and Executive Operations. The central office role is **Chief of Staff**. Opara remains the human executive authority for consequential decisions.

Priority markets are **TX, DC, MD, VA**. The remaining states are expansion-ready. Scheduled procurement cycles are 8:00 AM, 10:00 AM, 12:00 PM, 2:00 PM, and 4:00 PM America/Chicago.

## Runtime truthfulness

The UI must never invent execution. An agent is `working` only when a verified work packet/event exists. Otherwise it is `waiting`, `blocked`, `queued`, or `awaiting_approval`.

`GET /api/status` reports runtime readiness based on configured integrations. `GET /api/agents` exposes the role registry. Agent definitions are in `data/agents.json`; governed workflows are in `data/workflows.json`; permissions are in `data/governance.json`; persistent tables are defined in `data/schema.sql`.

## Work object model

`Opportunity → Work Packet → Agent Assignment → Artifact → Handoff → Approval → Decision`

The database schema includes opportunities, work packets, artifacts, handoffs, approvals, and verified agent events; `data/migrations/` tracks additive changes to that schema over time. `lib/agent-runner.js` contains the work-packet stage sequencing and governed approval gates, consulting `data/governance.json` via `lib/governance.js` before any consequential transition.

## Integrations required for full activation

The runtime currently checks for OpenAI model access, a persistent PostgreSQL/Supabase database, procurement-feed connectivity, and Gmail connectivity. Until those credentials/connectors are configured in Vercel, dependent employees intentionally show **Waiting for integration** rather than fake activity.

External communications, price commitments, submissions, contract acceptance, signatures/attestations, credential management, and destructive record actions remain approval-gated according to `data/governance.json`.

## Deployment

The repository is connected to the dedicated Vercel `processpilot-agents` project and is intended to publish independently at `processpilot-agents.vercel.app`.
