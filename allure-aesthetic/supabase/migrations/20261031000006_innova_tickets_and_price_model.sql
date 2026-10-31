-- =====================================================================
-- Allure Aesthetic — Migration 6: Innova-only tickets + per-branch price model
--
-- Client decisions (2026-10-31):
--   * Tickets exist ONLY for the Innova branch. The other 5 branches have
--     no tickets and no branch accounts: the agent books in Dentolize,
--     follows the steps, presses "تم الحجز", done.
--   * Innova tickets are for TODAY or TOMORROW only. The branch answers
--     offered / full / confirmed (+ offered_time); the agent can cancel.
--     Keep the 5-min SLA + supervisor escalation for Innova.
--   * "الحجز اكتمل" (fully booked) = a doctor_updates row of type 'full',
--     per doctor/day AND per whole-branch/day. Admin or the Innova branch
--     account can add/remove it; it blocks new Innova tickets.
--   * ALL editing (doctors, schedules, prices, rules, updates) is admin only.
--     The only branch write kept is: the Innova branch may add/remove 'full'
--     updates for its own branch.
--   * Prices move to a per-branch model mirroring docs/data/price-list.xlsx
--     (and Innova from the HTML). Replaces the old price-list tables.
--
-- NOTE on enums: this migration adds values to existing enum types and
-- also (re)creates functions that reference them. We only ever compare the
-- new enum values via ::text and never cast a *new* literal to the enum at
-- parse time, so creating the functions is safe in the same migration.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Enum additions
-- ---------------------------------------------------------------------
-- doctor_updates types from the HTML UP_TYPES:
--   laser_stop    = "وقف الليزر من ساعة"  (no laser from a time; uses at_time)
--   booking_cutoff= "وقف الحجز بعد ساعة"   (no booking after a time; uses at_time)
--   full          = "الحجز اكتمل"          (fully booked: doctor/day or branch/day)
alter type public.update_type add value if not exists 'laser_stop';
alter type public.update_type add value if not exists 'booking_cutoff';
alter type public.update_type add value if not exists 'full';

-- branch_response: the Innova reply set (HTML TK_STATUS). Old values are
-- kept so historical rows stay valid; the RPC accepts only the new three.
alter type public.branch_response add value if not exists 'offered';
alter type public.branch_response add value if not exists 'full';
alter type public.branch_response add value if not exists 'confirmed';

-- ---------------------------------------------------------------------
-- 2) branches / doctors flags
-- ---------------------------------------------------------------------
alter table public.branches
  add column if not exists has_tickets boolean not null default false,
  add column if not exists logo_url    text;

-- Only Innova has tickets; it also has a logo.
update public.branches set has_tickets = true,
       logo_url = coalesce(logo_url, '/brand/innova-logo.svg')
 where code = 'innova';

-- HTML RULES status:"Open" doctors (Heba, Passant, every Innova doctor).
-- Mirrors default_booking_status = 'open', kept as an explicit flag.
alter table public.doctors
  add column if not exists always_open boolean not null default false,
  add column if not exists specialty   text;   -- HTML doctor.specialty
update public.doctors set always_open = true where default_booking_status = 'open';

-- Knowledge base gains the new "مين يرشح إيه" guide + WhatsApp chat content.
alter table public.kb_articles drop constraint if exists kb_articles_kind_check;
alter table public.kb_articles
  add constraint kb_articles_kind_check
  check (kind in ('service', 'definition', 'manual', 'guide', 'chat'));

-- ---------------------------------------------------------------------
-- 3) doctor_updates: time + recurring columns
-- ---------------------------------------------------------------------
--   at_time    used by laser_stop / booking_cutoff ("from this time")
--   weekdays   recurring updates (HTML isRecurring / dows); Sat=0..Fri=6
alter table public.doctor_updates
  add column if not exists at_time  time,
  add column if not exists weekdays smallint[] not null default '{}';

-- ---------------------------------------------------------------------
-- 4) tickets: offered time (Innova "offered" reply)
-- ---------------------------------------------------------------------
alter table public.tickets
  add column if not exists offered_time time;

-- ---------------------------------------------------------------------
-- 5) rooms + per-weekday doctor room assignment (Innova)
-- ---------------------------------------------------------------------
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id) on delete cascade,
  code       text not null,                 -- 'r1', 'r2'
  title      text not null,
  sort       integer not null default 0,
  unique (branch_id, code)
);

create table if not exists public.doctor_rooms (
  doctor_id  uuid not null references public.doctors(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  primary key (doctor_id, weekday)
);

-- ---------------------------------------------------------------------
-- 6) Per-branch price model (replaces price_lists / price_categories /
--    price_items / laser_price_map / consultation_prices)
-- ---------------------------------------------------------------------
drop table if exists public.laser_price_map     cascade;
drop table if exists public.consultation_prices cascade;
drop table if exists public.price_items         cascade;
drop table if exists public.price_categories    cascade;
alter table public.branches drop column if exists price_list_id;
drop table if exists public.price_lists         cascade;
drop type  if exists public.consultation_kind;

-- Sections of the price list (Excel sheet "الأقسام").
create table public.price_categories (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,        -- FIL, LSR, CON, DPN, ...
  name_ar      text not null,
  name_en      text,
  sort         integer not null default 0,
  kb_slug      text,                         -- link into kb_articles
  -- "يبدأ من" badge: admin override. NULL = compute the minimum service price.
  starts_from  numeric(10,2),
  is_active    boolean not null default true
);

-- One row per Excel "كود البند". Prices are per branch (next table).
create table public.price_items (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,    -- FIL-01, LSR-01, CON-01, INV-001
  category_id       uuid not null references public.price_categories(id) on delete cascade,
  group_name        text,                    -- الخدمة / البراند
  variant           text,                    -- النوع / المنطقة
  unit              text,                    -- الوحدة
  full_name         text not null,           -- اسم البند الكامل
  item_type         text not null default 'service' check (item_type in ('service', 'addon')),
  availability_text text,                     -- متاح في
  notes             text,                     -- ملاحظات
  -- Display-only textual price for items with no numeric price
  -- (e.g. Innova "Re Cons" = "مجاني خلال شهر"). Numeric prices live in
  -- price_item_branch_prices; price_text is the fallback the UI shows.
  price_text        text,
  sort              integer not null default 0,
  is_active         boolean not null default true
);
create index on public.price_items (category_id);

-- No row = the item is not available in that branch. price 0 = free.
create table public.price_item_branch_prices (
  item_id    uuid not null references public.price_items(id) on delete cascade,
  branch_id  uuid not null references public.branches(id) on delete cascade,
  price      numeric(10,2) not null check (price >= 0),
  primary key (item_id, branch_id)
);
create index on public.price_item_branch_prices (branch_id);

-- Some items are doctor-specific (Excel CON-05..08 in Kafr El-Sheikh).
create table public.price_item_doctors (
  item_id    uuid not null references public.price_items(id) on delete cascade,
  doctor_id  uuid not null references public.doctors(id) on delete cascade,
  primary key (item_id, doctor_id)
);

-- Which price item covers which laser area(s). Multi-area rows are bundles
-- (Face & Neck, Bikini & Underarms, men Chest & Back). Women and men are
-- separate items. package3_item_code is NULL when there is no 3-session
-- package (men areas). References price_items.code (stable, unique).
-- Well-known codes used by the UI directly: pulse = LSR-21 (women) /
-- LSR-40 (men); the consultation card reads CON-01..08.
create table public.laser_area_price_map (
  id                  uuid primary key default gen_random_uuid(),
  area_codes          text[] not null check (cardinality(area_codes) > 0),
  gender              public.client_gender not null,
  single_item_code    text not null references public.price_items(code) on delete cascade,
  package3_item_code  text references public.price_items(code) on delete set null,
  sort                integer not null default 0,
  unique (area_codes)
);

-- ---------------------------------------------------------------------
-- 7) Decision + blocking: Innova-only tickets, today/tomorrow, 'full'
-- ---------------------------------------------------------------------
-- A doctor/day OR whole-branch/day "fully booked" ('full') block.
create or replace function public.full_update(p_doctor_id uuid, p_date date)
returns public.doctor_updates
language sql stable security definer set search_path = public as $$
  select u.* from public.doctor_updates u
  join public.doctors d on d.id = p_doctor_id
  where u.type::text = 'full'
    and p_date between u.date_from and u.date_to
    and (u.doctor_id = d.id or (u.doctor_id is null and u.branch_id = d.branch_id))
  order by u.doctor_id nulls first
  limit 1
$$;

-- create_ticket: Innova-only, today/tomorrow only, respects 'full'.
create or replace function public.create_ticket(
  p_doctor_id       uuid,
  p_service_code    text,
  p_customer_name   text,
  p_customer_phone  text,
  p_customer_gender public.client_gender,
  p_area_codes      text[],
  p_appt_date       date,
  p_start_time      time,
  p_end_time        time,
  p_agent_note      text default null
) returns public.tickets
language plpgsql security definer set search_path = public as $$
declare
  d    public.doctors;
  b    public.branches;
  svc  public.services;
  blk  public.doctor_updates;
  full_blk public.doctor_updates;
  dec  record;
  sla  integer;
  diff integer;
  t    public.tickets;
begin
  if not public.is_call_center() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into d from public.doctors where id = p_doctor_id and is_active;
  if not found then raise exception 'doctor_not_found' using errcode = 'P0002'; end if;

  select * into b from public.branches where id = d.branch_id;
  if not coalesce(b.has_tickets, false) then
    raise exception 'tickets_not_enabled_for_branch' using errcode = '22023';
  end if;

  select * into svc from public.services where code = p_service_code and is_active;
  if not found then raise exception 'service_not_found' using errcode = 'P0002'; end if;

  if not exists (select 1 from public.branch_services
                 where branch_id = d.branch_id and service_id = svc.id) then
    raise exception 'service_not_offered_in_branch' using errcode = '22023';
  end if;

  diff := p_appt_date - public.cairo_today();
  if diff < 0 then
    raise exception 'date_in_past' using errcode = '22023';
  end if;
  if diff > 1 then
    raise exception 'ticket_only_today_tomorrow' using errcode = '22023';
  end if;

  if p_customer_gender = 'male' and not d.accepts_men then
    raise exception 'doctor_does_not_accept_men' using errcode = '22023';
  end if;

  -- absent / booking stopped block (per doctor or whole branch)
  blk := public.blocking_update(d.id, p_appt_date);
  if blk.id is not null then
    raise exception '%', case when blk.doctor_id is null then 'branch_unavailable_on_date'
                              else 'doctor_unavailable_on_date' end
      using errcode = '22023', detail = coalesce(blk.note, '');
  end if;

  -- fully booked block (per doctor/day or branch/day)
  full_blk := public.full_update(d.id, p_appt_date);
  if full_blk.id is not null then
    raise exception 'fully_booked'
      using errcode = '22023', detail = coalesce(full_blk.note, '');
  end if;

  if svc.uses_laser_areas and coalesce(array_length(p_area_codes, 1), 0) = 0 then
    raise exception 'laser_areas_required' using errcode = '22023';
  end if;

  select * into dec from public.resolve_ticket_kind(d.id, p_appt_date);
  if dec.kind is null then
    raise exception 'no_ticket_needed'
      using errcode = '22023', hint = 'Book Open in Dentolize; the branch confirms later.';
  end if;

  select sla_minutes into sla from public.app_settings;

  insert into public.tickets (
    kind, kind_reason, dentolize_status, branch_id, doctor_id, service_id,
    customer_name, customer_phone, customer_gender, area_codes,
    appt_date, start_time, end_time, agent_note, created_by, sla_due_at
  ) values (
    dec.kind, dec.reason, dec.dentolize_status, d.branch_id, d.id, svc.id,
    trim(p_customer_name), trim(p_customer_phone), p_customer_gender, coalesce(p_area_codes, '{}'),
    p_appt_date, p_start_time, p_end_time, nullif(trim(p_agent_note), ''), auth.uid(),
    case when dec.kind = 'request' then now() + make_interval(mins => sla) end
  ) returning * into t;

  insert into public.ticket_events (ticket_id, actor_id, event, payload)
  values (t.id, auth.uid(), 'created', jsonb_build_object('kind', t.kind, 'reason', t.kind_reason));

  perform public._notify_role('branch', t.branch_id, t.id, 'new_ticket',
    case when t.kind = 'request' then 'طلب حجز جديد — مطلوب رد' else 'إشعار حجز جديد' end,
    d.display_name || ' — ' || to_char(t.appt_date, 'DD/MM') || ' ' || to_char(t.start_time, 'HH24:MI'));

  return t;
end $$;

-- branch_respond: Innova reply set is offered / full / confirmed.
-- offered needs p_offered_time. All three move the ticket to 'answered';
-- the agent calls the customer back and closes it. The old response values
-- are still rejected ('invalid_response') so callers use the new three.
-- The old 7-arg signature (counter_offer) is replaced by this 5-arg one.
drop function if exists public.branch_respond(uuid, public.branch_response, text, text, date, time, uuid);
create or replace function public.branch_respond(
  p_ticket_id          uuid,
  p_response           public.branch_response,
  p_responder_name     text default null,
  p_note               text default null,
  p_offered_time       time default null
) returns public.tickets
language plpgsql security definer set search_path = public as $$
declare
  t    public.tickets;
  role public.app_role := public.current_app_role();
begin
  select * into t from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'ticket_not_found' using errcode = 'P0002'; end if;

  if not (role = 'admin' or (role = 'branch' and t.branch_id = public.current_branch_id())) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if t.kind <> 'request' then raise exception 'not_a_request' using errcode = '22023'; end if;
  if t.status <> 'pending' then raise exception 'already_answered' using errcode = '22023'; end if;

  if p_response::text not in ('offered', 'full', 'confirmed') then
    raise exception 'invalid_response' using errcode = '22023';
  end if;
  if p_response::text = 'offered' and p_offered_time is null then
    raise exception 'offered_needs_time' using errcode = '22023';
  end if;

  update public.tickets set
    branch_response = p_response,
    responder_name  = nullif(trim(p_responder_name), ''),
    response_note   = nullif(trim(p_note), ''),
    offered_time    = case when p_response::text = 'offered' then p_offered_time end,
    responded_at    = now(),
    status          = 'answered'
  where id = t.id
  returning * into t;

  insert into public.ticket_events (ticket_id, actor_id, event, payload)
  values (t.id, auth.uid(), 'responded', jsonb_build_object(
    'response', p_response::text, 'responder_name', t.responder_name,
    'offered_time', to_char(t.offered_time, 'HH24:MI'),
    'late', t.sla_breached_at is not null));

  insert into public.notifications (user_id, ticket_id, kind, title, body)
  values (t.created_by, t.id, 'ticket_answered',
    'رد الفرع على تيكت #' || t.ticket_no,
    case p_response::text
      when 'offered'   then 'الفرع عرض ساعة فاضية: ' || to_char(t.offered_time, 'HH24:MI')
      when 'full'      then 'مفيش مواعيد — تأجيل'
      when 'confirmed' then 'اتأكد (Confirmed)'
      else '' end);

  return t;
end $$;

-- ---------------------------------------------------------------------
-- 8) Branch-wide-update trigger: allow 'full' (doctor or whole branch)
-- ---------------------------------------------------------------------
create or replace function public.doctor_updates_sync_branch()
returns trigger language plpgsql as $$
begin
  if new.doctor_id is not null then
    select d.branch_id into new.branch_id from public.doctors d where d.id = new.doctor_id;
    if new.branch_id is null then
      raise exception 'doctor % not found', new.doctor_id;
    end if;
  elsif new.branch_id is null then
    raise exception 'branch_id is required for a branch-wide update';
  end if;

  -- Branch-wide updates (doctor_id null) are limited to these types.
  if new.doctor_id is null and new.type::text not in ('off', 'stop', 'note', 'full') then
    raise exception 'branch-wide updates can only be off, stop, note or full' using errcode = '22023';
  end if;

  -- Branch accounts may change a doctor's booking status for today/tomorrow only.
  if new.type::text in ('open_slot', 'force_open')
     and public.current_app_role() = 'branch'
     and (new.date_from < public.cairo_today() or new.date_to > public.cairo_today() + 1) then
    raise exception 'status_change_only_today_or_tomorrow' using errcode = '22023';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 9) RLS: remove every branch write; keep only Innova branch 'full'
-- ---------------------------------------------------------------------
-- Branches no longer edit schedules (migration 5 policy).
drop policy if exists doctor_schedules_branch_write on public.doctor_schedules;

-- Replace the broad branch write on doctor_updates with admin-only + a
-- narrow branch policy (insert/delete type='full' for its own branch).
drop policy if exists doctor_updates_write on public.doctor_updates;

create policy doctor_updates_admin_write on public.doctor_updates
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy doctor_updates_branch_full_insert on public.doctor_updates
  for insert to authenticated
  with check (
    public.current_app_role() = 'branch'
    and type::text = 'full'
    and branch_id = public.current_branch_id()
    and created_by = auth.uid()
  );

create policy doctor_updates_branch_full_delete on public.doctor_updates
  for delete to authenticated
  using (
    public.current_app_role() = 'branch'
    and type::text = 'full'
    and branch_id = public.current_branch_id()
  );

-- ---------------------------------------------------------------------
-- 10) RLS for the new tables: authenticated reads, admin writes
-- ---------------------------------------------------------------------
alter table public.rooms                    enable row level security;
alter table public.doctor_rooms             enable row level security;
alter table public.price_categories         enable row level security;
alter table public.price_items              enable row level security;
alter table public.price_item_branch_prices enable row level security;
alter table public.price_item_doctors       enable row level security;
alter table public.laser_area_price_map     enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'rooms', 'doctor_rooms', 'price_categories', 'price_items',
    'price_item_branch_prices', 'price_item_doctors', 'laser_area_price_map'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.current_app_role() is not null)',
      tbl || '_read', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.current_app_role() = ''admin'')
         with check (public.current_app_role() = ''admin'')',
      tbl || '_admin_write', tbl);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 11) Grants for the changed RPC signatures
-- ---------------------------------------------------------------------
revoke execute on function public.branch_respond(uuid, public.branch_response, text, text, time) from public, anon;
grant  execute on function public.branch_respond(uuid, public.branch_response, text, text, time) to authenticated;

-- ---------------------------------------------------------------------
-- 12) One-off data fixes (safe no-ops on a fresh seed)
-- ---------------------------------------------------------------------
-- Cancel any open ticket that belongs to a branch that no longer has tickets.
do $$
declare r record;
begin
  for r in
    update public.tickets t
       set status = 'cancelled', closed_at = now()
      from public.branches b
     where b.id = t.branch_id
       and not coalesce(b.has_tickets, false)
       and t.status in ('pending', 'answered')
    returning t.id
  loop
    insert into public.ticket_events (ticket_id, event, payload)
    values (r.id, 'cancelled', jsonb_build_object('reason', 'tickets disabled for branch'));
  end loop;
end $$;

-- Deactivate every branch profile except Innova's (auth users are kept).
update public.profiles p
   set is_active = false
  from public.branches b
 where p.role = 'branch'
   and p.branch_id = b.id
   and b.code <> 'innova';

-- ---------------------------------------------------------------------
-- 13) Realtime: new room data is not live; prices are not live.
--     (doctor_updates is already in the publication from migration 4.)
-- ---------------------------------------------------------------------
