# Proposal: encrypt `integration_credentials.secret_value`

**Status: proposal only. Nothing in this document has been executed. Do not
run any of this against production without a separate, explicit go-ahead.**

## The problem

`integration_credentials.secret_value` (currently holds the Gmail OAuth
refresh token, via `lib/supabase-server.js`'s `upsertIntegrationCredential`/
`getIntegrationCredential`) is stored as plain `text`, with no
application-level encryption. Supabase encrypts the underlying disk/volume at
rest, and RLS + service-role-only access already limits *who* can query the
table through the API, but anyone with direct database access (a DB admin,
a leaked service-role key, a misconfigured backup) can currently read the
refresh token in cleartext from the table itself.

## Why not fix this immediately

Encrypting an existing secret in place is a real cutover: the app has to be
able to decrypt whatever it wrote, in production, without a gap where Gmail
integration breaks. Doing this quickly and un-reviewed risks locking out the
existing Gmail connection entirely. The user's own instruction was explicit:
"Do not expose or rotate existing credentials yet. Propose a safe encryption
migration" -- so this stays a proposal for review, not a Phase 1 change.

## Recommended approach: Supabase Vault

Supabase ships a `vault` schema (backed by `pgsodium`) specifically for this:
secrets are encrypted with a root key that Supabase manages outside the
database (so a raw `pg_dump` or leaked service-role key alone can't decrypt
them), and a `vault.decrypted_secrets` view transparently decrypts for
callers with sufficient privilege (service role / `postgres`).

### Migration plan (proposed, not executed)

1. **Add, don't replace.** Add a new nullable column:
   ```sql
   alter table integration_credentials add column if not exists secret_id uuid;
   ```
2. **Dual-write during transition.** For each existing row (today: just the
   one `gmail_refresh_token` row), create a Vault secret and record its id:
   ```sql
   update integration_credentials
   set secret_id = (select id from vault.create_secret(secret_value, integration_key, 'migrated from plaintext column'))
   where secret_id is null;
   ```
   `secret_value` is left untouched at this point -- nothing is deleted yet.
3. **Switch the read path.** Update `getIntegrationCredential()` in
   `lib/supabase-server.js` to read from `vault.decrypted_secrets` by
   `secret_id` when present, falling back to the plaintext `secret_value`
   column when `secret_id` is null (so any credential not yet migrated still
   works during the transition).
4. **Switch the write path.** Update `upsertIntegrationCredential()` to call
   `vault.create_secret`/`vault.update_secret` and store only `secret_id`
   going forward; stop writing new values into `secret_value`.
5. **Verify against a real Gmail reconnect** (start -> callback -> a real
   token refresh) before touching anything else. This is the step that
   proves the new path actually works end to end.
6. **Only after step 5 is confirmed working in production**, and only with
   explicit sign-off, drop the plaintext column:
   ```sql
   alter table integration_credentials drop column secret_value;
   ```
   This is the one genuinely destructive step in this plan and must not be
   automated or bundled with anything else.

### Why this order

Every step through #5 is additive and reversible -- if anything goes wrong,
the app can keep reading the plaintext column with zero code changes. Only
step 6 is irreversible, and it's isolated as its own explicit, separately
approved action, run only after the new path is proven.

## Alternative considered: application-level envelope encryption

Encrypt `secret_value` in the application layer (e.g., AES-256-GCM with a key
from a KMS/env var) before writing, decrypt on read. Rejected as the primary
recommendation because it means ProcessPilot's own runtime becomes
responsible for key management (rotation, where the key itself lives, what
happens if the env var is ever misconfigured) -- Supabase Vault already
solves that with infrastructure ProcessPilot doesn't have to build or
operate. It remains a reasonable fallback if Vault isn't available on the
project's Supabase plan.
