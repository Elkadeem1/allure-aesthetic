# Apply runbook — Phase 1a sync to live Supabase

Project ref `qpjbtamjuhgddsaftbqu`. Run in order. `$DB_URL` = the project's Postgres
connection string **with password** (Dashboard → Project Settings → Database → Connection string,
or the pooler URL in `supabase/.temp/pooler-url` with the password filled in).

> `supabase/seed.sql` is idempotent (UPSERT by code; missing → `is_active=false`; child/link
> tables refreshed) and already contains **both** the HTML data **and** the prices — so it covers
> "HTML sync" + `import-prices` in one atomic transaction. Running `node scripts/import-prices.mjs`
> separately afterwards is optional and would just re-UPSERT the same prices.

### 1. Backup first (do not skip)
```bash
mkdir -p backups
npx supabase db dump --linked -f backups/2026-10-31-schema.sql
npx supabase db dump --linked --data-only -f backups/2026-10-31-data.sql
# (needs `npx supabase login` once if not already logged in)
```

### 2–3. Already done / verified (see docs/sync-report.md §7)
Dry runs are clean. `backups/` is gitignored.

### 4. Apply
```bash
# 4a. schema + migration-6 data fixes (cancels 3 non-Innova open tickets, deactivates the tanta1
#     branch profile). Review the plan it prints before confirming.
npx supabase db push
#
#  CAUTION: `db push` applies every migration the remote's history table does NOT already list.
#  If the live DB was originally set up via the SQL editor (not `db push`), its history may be
#  empty and push would try to re-apply migrations 1–5 and fail on existing objects. Check first:
#     npx supabase migration list --linked      # shows local vs remote
#  If 1–5 are missing remotely but already applied, mark them applied without re-running:
#     npx supabase migration repair --status applied 20261003000001 20261003000002 \
#        20261003000003 20261003000004 20261004000005
#  …then `db push` applies only migration 6. (Alternative: apply just migration 6 directly:
#     psql "$DB_URL" -f supabase/migrations/20261031000006_innova_tickets_and_price_model.sql )

# 4b. reference data + prices (idempotent HTML sync + price import, one transaction)
psql "$DB_URL" -f supabase/seed.sql

# 4c. operational note: Dr Nourhan El Abd 'stop' update
psql "$DB_URL" -f supabase/post-sync.sql
```
(Steps 4b/4c can also be pasted into the Dashboard SQL Editor; `seed.sql` is large, so psql is easier.)

### 5. Verify
```bash
psql "$DB_URL" -f supabase/verify.sql
```
Expected: branches 7 · innova has_tickets true · active doctors 46 · rooms 2 · price_items 337 ·
price_item_branch_prices 1631 · DPN starts_from 750 · active branch profiles `(none)` · open
non-Innova tickets 0.

### After apply
- **Create the Innova branch account** (role `branch`, `branch_id` = Innova) — needs the service-role
  key in a server action; there is no Innova login yet, so active branch profiles will read `(none)`
  until it is created.
- The UI stays broken against the new schema until **Phase 1b** (regenerate
  `lib/types/database.types.ts`, rewrite the price/consultation data layer and the new
  `branch_respond`). Expected — do not start 1b yet.

### Rollback
`backups/2026-10-31-schema.sql` + `…-data.sql` restore the pre-change state. Migration 6 drops the
old price tables, so a rollback means restoring from the backup (or writing a down-migration).
