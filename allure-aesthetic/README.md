# Allure Aesthetic

Call-center booking assistant for Allure clinics — agents, branches, admin.
See `CLAUDE.md` for the full context and `docs/phase-1-database.md` for the schema.

## Phases
1. ✅ Database: schema, roles, RLS, tickets + SLA, seed from the MVP
2. Next.js app shell + auth + agent dashboard (branch view, read-only)
3. Booking engine (TypeScript port + tests) + wizard
4. Tickets UI: send, branch queue, realtime, 5-min SLA timer, sound
5. Branch updates screen + admin panel
6. Reports: response time per branch, SLA breaches, outcomes

## Quick start (database only)
```bash
# local check on any Postgres 15+
PGURL=postgres://postgres:postgres@localhost:5432/postgres scripts/test-db.sh

# Supabase
supabase init && supabase link --project-ref <ref> && supabase db push
```
