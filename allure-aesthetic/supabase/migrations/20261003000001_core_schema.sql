-- =====================================================================
-- Allure Aesthetic — Phase 1 / Migration 1: Core reference schema
-- Branches, doctors, schedules, services, laser areas, prices,
-- branch updates (temporary changes), knowledge base, user profiles.
--
-- Conventions
--   * Weekday numbering follows the MVP: Saturday = 0 ... Friday = 6.
--   * All "today" logic uses Africa/Cairo time (see cairo_today()).
--   * A row in `doctors` = one doctor AT one branch (an assignment).
--     The same person working in two branches has two rows linked by
--     `person_key`. Rules and schedules are per branch, so this keeps
--     the model simple.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.app_role       as enum ('admin', 'supervisor', 'agent', 'branch');
create type public.client_gender  as enum ('female', 'male');
create type public.shift_kind     as enum ('all', 'laser', 'other', 'derma');
create type public.booking_status as enum ('open', 'confirmed');
create type public.update_type    as enum (
  'off',        -- غايبة: not present at all
  'stop',       -- وقف حجز: present but no new bookings
  'hours',      -- ساعات مختلفة: replaces the fixed schedule for those days
  'open_slot',  -- الدور فاضي: book Confirmed instead of Open
  'note'        -- informational banner only (e.g. "starts derma at 2, laser at 4:30")
);
create type public.consultation_kind as enum ('derma', 'hair', 'derma_hair', 'recons', 'pulse');

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.cairo_today()
returns date language sql stable as $$
  select (now() at time zone 'Africa/Cairo')::date
$$;

-- Saturday = 0 ... Friday = 6  (Postgres dow: Sunday = 0)
create or replace function public.weekday_sat0(d date)
returns smallint language sql immutable as $$
  select ((extract(dow from d)::int + 1) % 7)::smallint
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Global settings (single row)
-- ---------------------------------------------------------------------
create table public.app_settings (
  id           boolean primary key default true check (id),
  sla_minutes  integer not null default 5 check (sla_minutes between 1 and 120),
  updated_at   timestamptz not null default now()
);
insert into public.app_settings (id) values (true);

-- ---------------------------------------------------------------------
-- Price lists (standard / New Cairo)
-- ---------------------------------------------------------------------
create table public.price_lists (
  id    uuid primary key default gen_random_uuid(),
  code  text not null unique,
  name  text not null
);

-- ---------------------------------------------------------------------
-- Branches
-- ---------------------------------------------------------------------
create table public.branches (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,            -- 'tanta1', 'newcairo', ...
  name_ar          text not null,
  address          text,
  payment_methods  text[] not null default '{}',
  managers         text[] not null default '{}',
  price_list_id    uuid references public.price_lists(id),
  is_active        boolean not null default true,
  sort             integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_branches_updated before update on public.branches
  for each row execute function public.set_updated_at();

-- How a branch wants bookings handled. Drives the ticket kind decision.
create table public.branch_policies (
  branch_id               uuid primary key references public.branches(id) on delete cascade,
  -- Open-doctor bookings within this many days of today become a REQUEST
  -- (branch must answer within the SLA). 1 = today + tomorrow.
  request_window_days     smallint not null default 1 check (request_window_days >= 0),
  -- Same-day bookings always need branch approval, even with a Confirmed doctor
  -- (MVP: Tanta 2 — "same day goes to the group first").
  same_day_always_request boolean  not null default false,
  -- Weekdays (Sat=0) where Open doctors are booked Confirmed + notice
  -- (MVP: Tanta 1 — Saturdays, because the branch is closed on Friday).
  auto_confirm_weekdays   smallint[] not null default '{}',
  allow_overlap           boolean  not null default true,
  booking_rules           text[]   not null default '{}',  -- display text for agents
  updated_at              timestamptz not null default now()
);
create trigger trg_branch_policies_updated before update on public.branch_policies
  for each row execute function public.set_updated_at();

-- Branch-wide laser cut-off. MVP Tanta 2: on Mon/Tue/Thu, morning shifts
-- (starting before 16:00) take no laser after 14:00.
create table public.branch_laser_cutoffs (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid not null references public.branches(id) on delete cascade,
  weekday              smallint not null check (weekday between 0 and 6),
  shift_starts_before  time not null,
  cutoff               time not null,
  unique (branch_id, weekday)
);

-- ---------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------
create table public.services (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,            -- 'laser', 'botox', ...
  name_ar               text not null,
  name_en               text not null,
  default_duration_min  smallint not null default 30 check (default_duration_min > 0),
  uses_laser_areas      boolean not null default false,  -- duration = sum of areas
  kb_slug               text,                            -- link into kb_articles
  sort                  integer not null default 0,
  is_active             boolean not null default true
);

create table public.branch_services (
  branch_id   uuid not null references public.branches(id) on delete cascade,
  service_id  uuid not null references public.services(id) on delete cascade,
  primary key (branch_id, service_id)
);

-- ---------------------------------------------------------------------
-- Laser areas (per gender) — durations, conflicts, combos
-- ---------------------------------------------------------------------
create table public.laser_areas (
  code                text primary key,          -- 'w_fullarms', 'm_beard', ...
  gender              public.client_gender not null,
  name_en             text not null,
  hint_ar             text,
  duration_min        smallint not null default 0 check (duration_min >= 0),
  is_small            boolean not null default false,  -- mustache / beard / underarm
  is_full_body        boolean not null default false,  -- excludes every other area
  requires_companion  boolean not null default false,  -- Bikini Line: never alone
  sort                integer not null default 0
);

-- Picking one removes the other (Half Arms <-> Full Arms). Stored both ways.
create table public.laser_area_conflicts (
  area_code       text not null references public.laser_areas(code) on delete cascade,
  conflicts_with  text not null references public.laser_areas(code) on delete cascade,
  primary key (area_code, conflicts_with),
  check (area_code <> conflicts_with)
);

-- Combo applies when ALL required_codes are picked AND (any_of_codes is
-- empty OR at least one of them is picked). Applied once.
-- e.g. Half Arms + (Half Legs Upper | Half Legs Lower)  ->  -30 min
create table public.laser_area_combos (
  id                   uuid primary key default gen_random_uuid(),
  label                text not null,
  required_codes       text[] not null,
  any_of_codes         text[] not null default '{}',
  duration_adjust_min  smallint not null default 0,  -- 0 = informational only
  sort                 integer not null default 0
);

-- ---------------------------------------------------------------------
-- Doctors (assignment of a doctor to a branch) + constraints
-- ---------------------------------------------------------------------
create table public.doctors (
  id                        uuid primary key default gen_random_uuid(),
  branch_id                 uuid not null references public.branches(id) on delete cascade,
  code                      text not null,                 -- slug, unique per branch
  display_name              text not null,
  person_key                text,                          -- same person across branches
  default_booking_status    public.booking_status not null default 'confirmed',
  accepts_men               boolean not null default true,
  laser_men_allowed         boolean not null default true,
  men_laser_area_codes      text[],                        -- null = all men areas allowed
  rejects_small_areas_only  boolean not null default false,
  no_overlap                boolean not null default false,
  notes                     text,
  is_active                 boolean not null default true,
  sort                      integer not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (branch_id, code)
);
create index on public.doctors (branch_id);
create trigger trg_doctors_updated before update on public.doctors
  for each row execute function public.set_updated_at();

-- Fixed weekly schedule. One row per segment; a day can have several.
create table public.doctor_schedules (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   uuid not null references public.doctors(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  kind        public.shift_kind not null default 'all',
  check (end_time > start_time)
);
create index on public.doctor_schedules (doctor_id, weekday);

-- Doctor-specific "last laser" time on a weekday (MVP: Mahitab Sat 18:00).
create table public.doctor_laser_cutoffs (
  doctor_id  uuid not null references public.doctors(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  cutoff     time not null,
  primary key (doctor_id, weekday)
);

-- ---------------------------------------------------------------------
-- Branch updates (temporary changes) — written by the branch account
-- Replaces both the MVP "Updates" tab and the MVP week overrides.
--   segments (for type 'hours'):
--     [{"start":"10:00","end":"14:00","kind":"laser"}, ...]
-- ---------------------------------------------------------------------
create table public.doctor_updates (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id) on delete cascade,
  doctor_id   uuid not null references public.doctors(id) on delete cascade,
  type        public.update_type not null,
  date_from   date not null,
  date_to     date not null,
  segments    jsonb not null default '[]'::jsonb,
  note        text,
  created_by  uuid,                      -- auth.users id (FK added at end of file)
  created_at  timestamptz not null default now(),
  check (date_to >= date_from),
  check (jsonb_typeof(segments) = 'array'),
  check (type <> 'hours' or jsonb_array_length(segments) > 0)
);
create index on public.doctor_updates (branch_id, date_from, date_to);
create index on public.doctor_updates (doctor_id, date_from, date_to);

-- Keep branch_id consistent with the doctor (it is used by RLS).
create or replace function public.doctor_updates_sync_branch()
returns trigger language plpgsql as $$
begin
  select d.branch_id into new.branch_id from public.doctors d where d.id = new.doctor_id;
  if new.branch_id is null then
    raise exception 'doctor % not found', new.doctor_id;
  end if;
  return new;
end $$;
create trigger trg_doctor_updates_branch before insert or update on public.doctor_updates
  for each row execute function public.doctor_updates_sync_branch();

-- ---------------------------------------------------------------------
-- Consultation prices (branch default; optional per-doctor override)
-- ---------------------------------------------------------------------
create table public.consultation_prices (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id) on delete cascade,
  doctor_id  uuid references public.doctors(id) on delete cascade,
  kind       public.consultation_kind not null,
  price      numeric(10,2) not null check (price >= 0),
  unique nulls not distinct (branch_id, doctor_id, kind)
);

-- ---------------------------------------------------------------------
-- Price catalogue
-- ---------------------------------------------------------------------
create table public.price_categories (
  id             uuid primary key default gen_random_uuid(),
  price_list_id  uuid not null references public.price_lists(id) on delete cascade,
  name           text not null,
  info_note      text,          -- shown above the table ("starts from 500 ...")
  kb_slug        text,
  sort           integer not null default 0,
  unique (price_list_id, name)
);

create table public.price_items (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.price_categories(id) on delete cascade,
  name         text not null,
  price        numeric(10,2),   -- null when price_text is used ("مجانًا")
  price_text   text,
  sort         integer not null default 0,
  check (price is not null or price_text is not null)
);
create index on public.price_items (category_id);

-- Which price item covers which laser area(s), per price list.
-- Multi-area rows are bundles (Face + Neck, Bikini + Under Arms, Chest + Back);
-- the pricing engine matches bundles first, then single areas.
create table public.laser_price_map (
  id                   uuid primary key default gen_random_uuid(),
  price_list_id        uuid not null references public.price_lists(id) on delete cascade,
  area_codes           text[] not null check (cardinality(area_codes) > 0),
  single_item_id       uuid not null references public.price_items(id) on delete cascade,
  package3_item_id     uuid references public.price_items(id) on delete set null,
  unique (price_list_id, area_codes)
);

-- ---------------------------------------------------------------------
-- Knowledge base: service guides (22), product definitions, call-skills
-- manual sections. Body is JSON so the UI can render rich blocks.
-- ---------------------------------------------------------------------
create table public.kb_articles (
  slug        text primary key,     -- 'service:botox', 'def:laser', 'manual:scenarios'
  kind        text not null check (kind in ('service', 'definition', 'manual')),
  title       text not null,
  body        jsonb not null,
  sort        integer not null default 0,
  updated_at  timestamptz not null default now()
);
create trigger trg_kb_updated before update on public.kb_articles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- User profiles (one per auth user)
-- One account per branch (role 'branch' + branch_id).
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        public.app_role not null,
  branch_id   uuid references public.branches(id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check ((role = 'branch') = (branch_id is not null))
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.doctor_updates
  add constraint doctor_updates_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
