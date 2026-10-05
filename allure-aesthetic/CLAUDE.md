# Allure Aesthetic — Call Center Booking Assistant

Internal system for **Allure clinics** (6 branches in Egypt). It helps call-center
agents book the right doctor and coordinates every booking with the branch.

**Dentolize stays the official booking system.** This app does NOT replace it.
It gives agents the information + decision, and carries the coordination
(tickets) between the call center and the branch.

## Roles
| Role | Who | Can do |
|---|---|---|
| `admin` | system owner | everything; creates accounts; edits branches, doctors, schedules, prices, rules |
| `supervisor` | team lead (Ahmed Taher) | sees all tickets; receives SLA-breach alerts; can cancel tickets |
| `agent` | call-center agent | branch dashboard + booking wizard; creates/closes tickets |
| `branch` | **one shared account per branch** | sees only its own tickets; answers them; writes its own doctor updates (incl. branch-wide closed/full days and Open↔Confirmed for today/tomorrow); edits its doctors' weekly schedules |

## Core flow
1. Customer calls. Agent uses the wizard: branch → service → gender → areas → doctor → date → start time (end time auto from duration).
2. The engine filters doctors (schedule, rules, branch updates) and the server decides the ticket kind (`resolve_ticket_kind`).
3. Agent books in Dentolize with the status the system shows (`dentolize_status`), then sends the ticket.
   Open doctor on a day after tomorrow → **no ticket**: agent books Open in Dentolize and the branch confirms later.
4. **REQUEST** (Open doctor, appointment today/tomorrow): branch must answer within **5 min (SLA)**:
   `agent_confirm` (agent confirms with customer) · `branch_confirm` (branch handles it) · `counter_offer` · `unavailable`.
   If late: ticket stays in the branch queue flagged red AND the supervisor is notified. Branch can still answer.
5. **NOTICE** (Confirmed doctor, or Open turned Confirmed by a rule / "الدور فاضي"): branch only acknowledges. No SLA.
6. Agent calls the customer back and closes the ticket with an outcome.

## Stack
- Next.js 15 (App Router) + TypeScript, deployed on Vercel
- Supabase: Postgres, Auth, RLS, Realtime, pg_cron
- Tailwind v4 + shadcn/ui v4, **RTL Arabic UI**, font Tajawal (Google Fonts)
- **Design system — light theme only, no dark mode**:
  - Page background `#F5F7FB`, card surface `#FFFFFF`, primary `#2563EB` (hover `#1D4ED8`)
  - Border `#E4E8F0`, text `#0F172A`, muted text `#64748B`
  - **5 fixed status colors** (never reuse across states):
    - confirmed → green `#16A34A` / bg `#DCFCE7` — CSS vars `--status-confirmed` / `--status-confirmed-bg`
    - open      → amber `#D97706` / bg `#FEF3C7`
    - request   → blue `#2563EB` / bg `#DBEAFE`
    - notice    → grey `#6B7280` / bg `#F3F4F6`
    - SLA breach → red `#DC2626` / bg `#FEE2E2` + `animate-sla-pulse` class
  - Button variants: `default` (blue solid), `secondary` (white/border), `ghost`, `danger` (red); all have `loading` prop (Loader2 spinner)
  - Toasts: sonner `<Toaster>` in root layout with `dir="rtl"`; call `toast.success()` / `toast.error()`
- React Hook Form + Zod, date-fns-tz (`Africa/Cairo`), Vitest

## Repo layout
```
supabase/migrations/   SQL migrations (source of truth for the schema)
supabase/seed.sql      GENERATED from the MVP — do not hand-edit
supabase/tests/        SQL tests (run on a local Postgres via scripts/test-db.sh)
scripts/extract-mvp.mjs  MVP HTML → seed.sql
docs/mvp/              the original HTML guide + idea doc (reference for UI and engine logic)
docs/phase-1-database.md  schema walkthrough + open questions
app/ (phase 2+)        (admin) (agent) (branch) route groups
lib/engine/ (phase 3)  booking engine, pure TypeScript + Vitest
```

## Database rules — read before touching data code
- **Weekday numbering: Saturday = 0 … Friday = 6** (same as the MVP). Use `weekday_sat0()` in SQL.
- **"Today" is always Africa/Cairo** (`cairo_today()` in SQL, date-fns-tz in TS). Never use the server's local date.
- A `doctors` row = a doctor **at one branch**. Same person in two branches = two rows sharing `person_key`.
- Ticket tables are **read-only for clients**. All writes go through RPCs:
  `create_ticket`, `branch_respond`, `acknowledge_notice`, `close_ticket`, `cancel_ticket`.
  Never add client insert/update policies on `tickets` or `ticket_events`.
- `resolve_ticket_kind` (SQL) is the single source of truth for request vs notice. The UI may preview it, not re-implement it.
- Temporary changes (absent, booking stopped, different hours, "الدور فاضي", info note) are `doctor_updates`. They replace the MVP's week overrides.
- Account creation needs the service-role key → only in server actions / route handlers, never in the browser.
- New tables: enable RLS in the same migration and add policies. Add to the `supabase_realtime` publication if the UI needs live updates.

## Engine (phase 3)
Port the MVP engine from `docs/mvp/call-center-guide-mvp.html` (second `<script>`):
`parseDay`, `evalDoctor`, `windowsFor`, `verdictFor`, `laserMinutes`, `toggleArea`, `nextDates`, `priceHtml`.
Keep it pure (data in, result out), read rules from the DB tables, and cover every rule with a Vitest case.

## Commands
```bash
node scripts/extract-mvp.mjs > supabase/seed.sql     # regenerate seed
PGURL=postgres://postgres:postgres@localhost:5432/postgres scripts/test-db.sh   # local SQL tests
supabase db reset                                     # with Supabase CLI: migrations + seed
```

## Working agreements
- Short, focused sessions. Stop at the end of each phase step for review.
- **Mostafa owns git**: do not commit or push unless explicitly asked.
- UI text in Egyptian Arabic, minimal tashkeel. Code, comments, and commit messages in English.
- Never surface medical advice in UI copy; reuse the approved texts in `kb_articles`.
