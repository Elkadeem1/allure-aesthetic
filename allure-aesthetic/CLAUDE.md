# Allure Aesthetic — Call Center Booking Assistant

Internal system for **Allure clinics** (6 branches in Egypt). It helps call-center
agents book the right doctor and coordinates every booking with the branch.

**Dentolize stays the official booking system.** This app does NOT replace it.
It gives agents the information + decision, and carries the coordination
(tickets) between the call center and the branch.

## Roles
| Role | Who | Can do |
|---|---|---|
| `admin` | system owner | everything; creates accounts; edits branches, doctors, schedules, prices, rules, all updates |
| `supervisor` | team lead (Ahmed Taher) | sees all tickets; receives SLA-breach alerts; can cancel tickets |
| `agent` | call-center agent | branch dashboard + booking wizard; creates/closes tickets (Innova only) |
| `branch` | **Innova only — one shared account** | sees only Innova's tickets; answers them (offered / full / confirmed); may add/remove `full` ("الحجز اكتمل") for its own branch. **No other write.** The 5 non-Innova branches have no account. |

## Core flow (client decisions, 2026-10-31)
**Tickets exist only for the Innova branch.** For the other 5 branches there is no ticket and no branch account: the agent uses the wizard, books in Dentolize with the status shown (`dentolize_status`), follows the steps, presses "تم الحجز" — done.

For **Innova** only:
1. Agent uses the wizard: branch → service → gender → areas → doctor → date → start time (end auto from duration).
2. The engine filters doctors; the server decides the ticket (`resolve_ticket_kind`). `create_ticket` rejects: non-Innova (`tickets_not_enabled_for_branch`), dates past tomorrow (`ticket_only_today_tomorrow`), and doctor/branch days marked `full` (`fully_booked`).
3. Agent books in Dentolize, then sends the ticket (today/tomorrow only).
4. Branch must answer within **5 min (SLA)** via `branch_respond`: `offered` (another free time, with `offered_time`) · `full` (no slots → postpone) · `confirmed`. If late: ticket stays in the branch queue flagged red AND the supervisor is notified; the branch can still answer. Agent can still cancel.
5. Agent calls the customer back and closes the ticket with an outcome.

"الحجز اكتمل" (fully booked) = a `doctor_updates` row of type `full`, **per doctor/day AND per whole branch/day**. Admin and the Innova branch account set/remove it. Daily caps ("٣٠ عميل في اليوم") stay as doctor notes — no counting.

## Stack
- Next.js 15 (App Router) + TypeScript, deployed on Vercel
- Supabase: Postgres, Auth, RLS, Realtime, pg_cron
- Tailwind v4 + shadcn/ui v4, **RTL Arabic UI**, font Tajawal (Google Fonts)
- **Design system — warm clinic theme, LIGHT only, no dark mode** (tokens in `app/globals.css`):
  - Parent brand **Allure = sage**, the **Innova branch = rose**. The app primary is **rose**; sage + gold are status accents. Brand logos live in `public/brand/` (`allure-logo.svg` sage, `innova-logo.svg` rose) — render via `components/app/brand-logo.tsx` (text-wordmark fallback, never a broken image). Innova's logo comes from `branches.logo_url`.
  - bg `#FBF8F6`, surface `#FFFFFF`, ink `#2B2320`, ink-soft `#6E6259`, line `#E8E0DA`
  - rose `#AD5A66` (primary) · rose-deep `#8B4450` (hover, `var(--primary-hover)`) · rose-tint `#F6E9EA` (accent)
  - sage `#5E7F66` + sage-tint `#E9F1EA` · gold `#B8934F` + gold-tint `#FBF1DE` — CSS vars `--sage` / `--gold` / `--rose` etc.
  - **No blue/indigo/violet anywhere** (grep before shipping). Use theme tokens, not raw hexes.
  - **5 fixed status colors** (never reuse across states):
    - confirmed → sage `#5E7F66` / bg `#E9F1EA` — CSS vars `--status-confirmed` / `--status-confirmed-bg`
    - open      → gold `#B8934F` / bg `#FBF1DE`
    - request/ticket → rose `#AD5A66` / bg `#F6E9EA`
    - notice/neutral → grey `#6E6259` / bg `#F0EAE5`
    - SLA breach → red `#C0392B` / bg `#F7E3E0` + `animate-sla-pulse` class
  - Radius 12–16px (`--radius` 0.75rem, lg 1rem). Soft warm shadows (`--shadow*`, ink-tinted — `shadow-sm`/`md`/`lg` are themed).
  - Button variants: `default` (rose solid), `secondary` (white/border), `ghost`, `danger` (red); all have `loading` (Loader2), `active:scale-[0.98]`, and a focus ring.
  - Shell: right sidebar (`الفروع · تيكتاتي · مهارات المكالمة[drawer] · دليل الخدمات`; SLA board for supervisor/admin). A bottom-left floating cluster (`+` booking · `?` recommend · chat) opens drawers; Ctrl+B opens booking. One reusable `components/app/drawer.tsx` (slide-in, overlay, Esc/overlay close, focus trap, one at a time). No "حجز جديد" in the sidebar or dashboard header.
  - Toasts: sonner `<Toaster>` in root layout with `dir="rtl"`; call `toast.success()` / `toast.error()`
- React Hook Form + Zod, date-fns-tz (`Africa/Cairo`), Vitest

## Repo layout
```
supabase/migrations/   SQL migrations (source of truth for the schema)
supabase/seed.sql      GENERATED (extractor + price importer) — do not hand-edit
supabase/tests/        SQL tests (run on a local Postgres via scripts/test-db.sh)
scripts/extract-mvp.mjs    agent-hub HTML → seed.sql (everything except prices; calls the importer)
scripts/import-prices.mjs  price-list.xlsx + Innova HTML → price model (idempotent upsert by code)
scripts/gen-sync-report.mjs  dry-run diff vs the current DB → docs/sync-report.md
docs/mvp/agent-hub-2026-10.html  CURRENT source of truth (data + rules); supersedes call-center-guide-mvp.html
docs/data/price-list.xlsx  CURRENT source of truth for ALL prices (Innova excepted)
docs/sync-report.md    latest dry-run report
docs/phase-1-database.md  schema walkthrough + open questions
app/ (phase 2+)        (admin) (agent) (branch) route groups
lib/engine/ (phase 3)  booking engine, pure TypeScript + Vitest
```

## Source of truth — the DATABASE, not the HTML (post Phase 5)
Since the admin panel went live, **admins edit doctors, schedules, branches, rooms,
rules and prices in-app, and the database is the source of truth** — not
`docs/mvp/agent-hub-2026-10.html`. Re-running the HTML → DB sync would overwrite
those edits, so the sync scripts are guarded: `scripts/extract-mvp.mjs` (and
`scripts/sync-hub.mjs --apply`) **refuse to run / write to a live DB unless passed
`--i-know-this-overwrites-admin-edits`** (see `scripts/guard-live.mjs`). The HTML
is now only for seeding a brand-new database.

## Database rules — read before touching data code
- **Weekday numbering: Saturday = 0 … Friday = 6** (same as the MVP). Use `weekday_sat0()` in SQL.
- **"Today" is always Africa/Cairo** (`cairo_today()` in SQL, date-fns-tz in TS). Never use the server's local date.
- A `doctors` row = a doctor **at one branch**. Same person in two branches = two rows sharing `person_key`.
- Ticket tables are **read-only for clients**. All writes go through RPCs:
  `create_ticket`, `branch_respond`, `acknowledge_notice`, `close_ticket`, `cancel_ticket`.
  Never add client insert/update policies on `tickets` or `ticket_events`. **Tickets are Innova-only**
  (`branches.has_tickets`), today/tomorrow only; `branch_respond` accepts only `offered`/`full`/`confirmed`.
- `resolve_ticket_kind` (SQL) is the single source of truth for request vs notice. The UI may preview it, not re-implement it.
- **All editing is admin-only.** The one branch write left: the Innova account may `insert`/`delete`
  `doctor_updates` with `type='full'` for its own branch. Never re-add branch write policies on
  `doctor_schedules` or on other `doctor_updates` types.
- Temporary changes are `doctor_updates`: `off`, `stop`, `hours`, `open_slot` ("الدور فاضي"), `note`,
  `force_open`, plus `laser_stop` / `booking_cutoff` (use `at_time`) and `full` ("الحجز اكتمل").
  Recurring updates use `weekdays`. They replace the MVP's week overrides.
- **Prices are per branch**: `price_items` (stable code = Excel "كود البند") × `price_item_branch_prices`
  (no row = unavailable, `0` = free). Prices come from `docs/data/price-list.xlsx`; **Innova from the HTML**
  (codes `INV-xxx`). `price_text` only for textual prices (Innova Re Cons). `starts_from` on a category
  overrides the "يبدأ من" badge (DPN = 750). Pulse = `LSR-21`/`LSR-40`; consultation card = `CON-01..08`.
- Account creation needs the service-role key → only in server actions / route handlers, never in the browser.
- New tables: enable RLS in the same migration and add policies. Add to the `supabase_realtime` publication if the UI needs live updates.

## Engine (phase 3)
Port the MVP engine from `docs/mvp/agent-hub-2026-10.html` (second `<script>`, the IIFE):
`parseDay`, `evalDoctor`, `windowsFor`, `verdictFor`, `laserMinutes`, `toggleArea`, `nextDates`, `priceHtml`.
Keep it pure (data in, result out), read rules from the DB tables, and cover every rule with a Vitest case.

## Commands
```bash
# Seeds a NEW DB only. The DB is now the source of truth; this OVERWRITES admin edits,
# so it refuses to run without the override flag (see scripts/guard-live.mjs).
node scripts/extract-mvp.mjs --i-know-this-overwrites-admin-edits > supabase/seed.sql
node scripts/import-prices.mjs                        # prices only, idempotent upsert SQL (admin "upload price list")
node scripts/gen-sync-report.mjs /tmp/seed-old.sql    # dry-run diff vs current DB -> docs/sync-report.md
PGURL=postgres://postgres:postgres@localhost:5432/postgres scripts/test-db.sh   # local SQL tests (needs psql)
supabase db reset                                     # with Supabase CLI: migrations + seed
```

## Working agreements
- Short, focused sessions. Stop at the end of each phase step for review.
- **Mostafa owns git**: do not commit or push unless explicitly asked.
- UI text in Egyptian Arabic, minimal tashkeel. Code, comments, and commit messages in English.
- Never surface medical advice in UI copy; reuse the approved texts in `kb_articles`.
