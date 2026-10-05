-- =====================================================================
-- Allure Aesthetic — Phase 1 / Migration 2: Tickets workflow
--
-- Dentolize stays the official booking system. A ticket is NOT the
-- booking: it is the coordination record between the call center and
-- the branch about a booking the agent made in Dentolize.
--
--   REQUEST  Open doctor, appointment inside the branch window
--            (default: today/tomorrow). Branch must answer within SLA.
--   NOTICE   Confirmed doctor (or Open doctor turned Confirmed by a rule
--            / "الدور فاضي" update). Branch only acknowledges. No SLA.
--
-- All writes go through SECURITY DEFINER functions (RPCs). The tables
-- themselves are read-only for clients (see migration 3 / RLS).
-- =====================================================================

create type public.ticket_kind     as enum ('request', 'notice');
create type public.ticket_status   as enum ('pending', 'answered', 'closed', 'cancelled');
create type public.branch_response as enum (
  'agent_confirm',   -- أكدوا إنتوا: agent calls the customer and confirms
  'branch_confirm',  -- إحنا هنأكد معاها: branch handles confirmation
  'counter_offer',   -- ميعاد بديل
  'unavailable'      -- مش متاح
);
create type public.ticket_outcome as enum (
  'customer_confirmed', 'customer_declined', 'no_answer',
  'handled_by_branch', 'notice_acknowledged'
);

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table public.tickets (
  id                  uuid primary key default gen_random_uuid(),
  ticket_no           bigint generated always as identity unique,
  kind                public.ticket_kind not null,
  status              public.ticket_status not null default 'pending',
  kind_reason         text not null,                 -- why request/notice (audit)
  dentolize_status    public.booking_status not null, -- status the agent sets in Dentolize

  branch_id           uuid not null references public.branches(id),
  doctor_id           uuid not null references public.doctors(id),
  service_id          uuid not null references public.services(id),
  customer_name       text not null check (length(trim(customer_name)) > 0),
  customer_phone      text not null check (length(trim(customer_phone)) >= 8),
  customer_gender     public.client_gender not null,
  area_codes          text[] not null default '{}',
  appt_date           date not null,
  start_time          time not null,
  end_time            time not null,
  agent_note          text,
  created_by          uuid not null references auth.users(id),
  created_at          timestamptz not null default now(),

  -- SLA (requests only)
  sla_due_at          timestamptz,
  sla_breached_at     timestamptz,

  -- Branch side
  branch_response     public.branch_response,
  responder_name      text,         -- branch account is shared: who actually answered
  response_note       text,
  counter_date        date,
  counter_start_time  time,
  counter_doctor_id   uuid references public.doctors(id),
  responded_at        timestamptz,
  acknowledged_at     timestamptz,

  -- Closing
  outcome             public.ticket_outcome,
  closed_by           uuid references auth.users(id),
  closed_at           timestamptz,
  updated_at          timestamptz not null default now(),

  check (end_time > start_time),
  check ((kind = 'request') = (sla_due_at is not null))
);
create index on public.tickets (branch_id, status, created_at desc);
create index on public.tickets (created_by, created_at desc);
create index on public.tickets (status, sla_due_at) where kind = 'request';
create trigger trg_tickets_updated before update on public.tickets
  for each row execute function public.set_updated_at();

-- Append-only history of everything that happened to a ticket.
create table public.ticket_events (
  id          bigint generated always as identity primary key,
  ticket_id   uuid not null references public.tickets(id) on delete cascade,
  actor_id    uuid references auth.users(id),
  event       text not null,  -- created, responded, acknowledged, sla_breached, closed, cancelled
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index on public.ticket_events (ticket_id, id);

-- In-app notifications (badge + sound). Delivered live via Realtime.
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  ticket_id   uuid references public.tickets(id) on delete cascade,
  kind        text not null,  -- new_ticket, ticket_answered, sla_breached
  title       text not null,
  body        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.notifications (user_id, read_at, created_at desc);

-- ---------------------------------------------------------------------
-- Caller identity helpers (used by RPCs and RLS)
-- SECURITY DEFINER so they can read profiles without hitting RLS loops.
-- ---------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.current_branch_id()
returns uuid language sql stable security definer set search_path = public as $$
  select branch_id from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_call_center()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() in ('admin', 'supervisor', 'agent'), false)
$$;

-- ---------------------------------------------------------------------
-- Decision: request or notice?
-- Single source of truth on the server. The UI calls it to preview the
-- decision before the agent sends the ticket.
-- ---------------------------------------------------------------------
create or replace function public.resolve_ticket_kind(p_doctor_id uuid, p_date date)
returns table (kind public.ticket_kind, dentolize_status public.booking_status, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  d    public.doctors;
  pol  public.branch_policies;
  diff integer := p_date - public.cairo_today();
begin
  select * into d from public.doctors where id = p_doctor_id;
  if not found then
    raise exception 'doctor_not_found' using errcode = 'P0002';
  end if;
  select * into pol from public.branch_policies where branch_id = d.branch_id;

  if coalesce(pol.same_day_always_request, false) and diff = 0 then
    return query select 'request'::public.ticket_kind, 'open'::public.booking_status, 'same_day_branch_rule';
    return;
  end if;

  if d.default_booking_status = 'confirmed' then
    return query select 'notice'::public.ticket_kind, 'confirmed'::public.booking_status, 'doctor_confirmed';
    return;
  end if;

  if exists (
    select 1 from public.doctor_updates u
    where u.doctor_id = d.id and u.type = 'open_slot'
      and p_date between u.date_from and u.date_to
  ) then
    return query select 'notice'::public.ticket_kind, 'confirmed'::public.booking_status, 'open_slot_update';
    return;
  end if;

  if public.weekday_sat0(p_date) = any (coalesce(pol.auto_confirm_weekdays, '{}')) then
    return query select 'notice'::public.ticket_kind, 'confirmed'::public.booking_status, 'auto_confirm_weekday';
    return;
  end if;

  if diff <= coalesce(pol.request_window_days, 1) then
    return query select 'request'::public.ticket_kind, 'open'::public.booking_status, 'open_doctor_in_window';
    return;
  end if;

  -- Open doctor, appointment further away: booked Open, branch informed.
  -- TODO(confirm with client): should this be a REQUEST too?
  return query select 'notice'::public.ticket_kind, 'open'::public.booking_status, 'open_doctor_outside_window';
end $$;

-- ---------------------------------------------------------------------
-- Internal: notify every active user of a role (optionally one branch)
-- ---------------------------------------------------------------------
create or replace function public._notify_role(
  p_role public.app_role, p_branch uuid, p_ticket uuid, p_kind text, p_title text, p_body text
) returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, ticket_id, kind, title, body)
  select p.id, p_ticket, p_kind, p_title, p_body
  from public.profiles p
  where p.role = p_role and p.is_active
    and (p_branch is null or p.branch_id = p_branch)
$$;

-- ---------------------------------------------------------------------
-- RPC: agent creates a ticket after booking in Dentolize
-- ---------------------------------------------------------------------
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
  d       public.doctors;
  svc     public.services;
  dec     record;
  sla     integer;
  t       public.tickets;
begin
  if not public.is_call_center() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into d from public.doctors where id = p_doctor_id and is_active;
  if not found then raise exception 'doctor_not_found' using errcode = 'P0002'; end if;

  select * into svc from public.services where code = p_service_code and is_active;
  if not found then raise exception 'service_not_found' using errcode = 'P0002'; end if;

  if not exists (select 1 from public.branch_services
                 where branch_id = d.branch_id and service_id = svc.id) then
    raise exception 'service_not_offered_in_branch' using errcode = '22023';
  end if;

  if p_appt_date < public.cairo_today() then
    raise exception 'date_in_past' using errcode = '22023';
  end if;

  if p_customer_gender = 'male' and not d.accepts_men then
    raise exception 'doctor_does_not_accept_men' using errcode = '22023';
  end if;

  if exists (select 1 from public.doctor_updates u
             where u.doctor_id = d.id and u.type in ('off', 'stop')
               and p_appt_date between u.date_from and u.date_to) then
    raise exception 'doctor_unavailable_on_date' using errcode = '22023';
  end if;

  if svc.uses_laser_areas and coalesce(array_length(p_area_codes, 1), 0) = 0 then
    raise exception 'laser_areas_required' using errcode = '22023';
  end if;

  select * into dec from public.resolve_ticket_kind(d.id, p_appt_date);
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

-- ---------------------------------------------------------------------
-- RPC: branch answers a REQUEST (allowed after SLA breach too)
-- ---------------------------------------------------------------------
create or replace function public.branch_respond(
  p_ticket_id          uuid,
  p_response           public.branch_response,
  p_responder_name     text default null,
  p_note               text default null,
  p_counter_date       date default null,
  p_counter_start_time time default null,
  p_counter_doctor_id  uuid default null
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

  if p_response = 'counter_offer' and (p_counter_date is null or p_counter_start_time is null) then
    raise exception 'counter_offer_needs_date_and_time' using errcode = '22023';
  end if;
  if p_counter_doctor_id is not null and not exists (
       select 1 from public.doctors where id = p_counter_doctor_id and branch_id = t.branch_id) then
    raise exception 'counter_doctor_not_in_branch' using errcode = '22023';
  end if;

  update public.tickets set
    branch_response    = p_response,
    responder_name     = nullif(trim(p_responder_name), ''),
    response_note      = nullif(trim(p_note), ''),
    counter_date       = case when p_response = 'counter_offer' then p_counter_date end,
    counter_start_time = case when p_response = 'counter_offer' then p_counter_start_time end,
    counter_doctor_id  = case when p_response = 'counter_offer' then p_counter_doctor_id end,
    responded_at       = now(),
    status             = case when p_response = 'branch_confirm' then 'closed' else 'answered' end::public.ticket_status,
    outcome            = case when p_response = 'branch_confirm' then 'handled_by_branch'::public.ticket_outcome end,
    closed_at          = case when p_response = 'branch_confirm' then now() end,
    closed_by          = case when p_response = 'branch_confirm' then auth.uid() end
  where id = t.id
  returning * into t;

  insert into public.ticket_events (ticket_id, actor_id, event, payload)
  values (t.id, auth.uid(), 'responded', jsonb_build_object(
    'response', p_response, 'responder_name', t.responder_name,
    'late', t.sla_breached_at is not null));

  insert into public.notifications (user_id, ticket_id, kind, title, body)
  values (t.created_by, t.id, 'ticket_answered',
    'رد الفرع على تيكت #' || t.ticket_no,
    case p_response
      when 'agent_confirm'  then 'أكدوا إنتوا مع العميل'
      when 'branch_confirm' then 'الفرع هيأكد مع العميل'
      when 'counter_offer'  then 'الفرع اقترح ميعاد بديل'
      else 'مش متاح' end);

  return t;
end $$;

-- ---------------------------------------------------------------------
-- RPC: branch acknowledges a NOTICE ("تم الاطلاع")
-- ---------------------------------------------------------------------
create or replace function public.acknowledge_notice(
  p_ticket_id uuid, p_responder_name text default null
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
  if t.kind <> 'notice' then raise exception 'not_a_notice' using errcode = '22023'; end if;
  if t.status <> 'pending' then raise exception 'already_handled' using errcode = '22023'; end if;

  update public.tickets set
    status = 'closed', outcome = 'notice_acknowledged',
    acknowledged_at = now(), responder_name = nullif(trim(p_responder_name), ''),
    closed_at = now(), closed_by = auth.uid()
  where id = t.id returning * into t;

  insert into public.ticket_events (ticket_id, actor_id, event, payload)
  values (t.id, auth.uid(), 'acknowledged', jsonb_build_object('responder_name', t.responder_name));
  return t;
end $$;

-- ---------------------------------------------------------------------
-- RPC: agent closes the loop after calling the customer
-- ---------------------------------------------------------------------
create or replace function public.close_ticket(
  p_ticket_id uuid, p_outcome public.ticket_outcome, p_note text default null
) returns public.tickets
language plpgsql security definer set search_path = public as $$
declare t public.tickets;
begin
  if not public.is_call_center() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_outcome not in ('customer_confirmed', 'customer_declined', 'no_answer') then
    raise exception 'invalid_outcome' using errcode = '22023';
  end if;

  select * into t from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'ticket_not_found' using errcode = 'P0002'; end if;
  if t.status <> 'answered' then raise exception 'ticket_not_answered' using errcode = '22023'; end if;

  update public.tickets set status = 'closed', outcome = p_outcome,
    closed_at = now(), closed_by = auth.uid()
  where id = t.id returning * into t;

  insert into public.ticket_events (ticket_id, actor_id, event, payload)
  values (t.id, auth.uid(), 'closed', jsonb_build_object('outcome', p_outcome, 'note', nullif(trim(p_note), '')));
  return t;
end $$;

-- ---------------------------------------------------------------------
-- RPC: cancel (customer changed their mind, agent mistake, ...)
-- ---------------------------------------------------------------------
create or replace function public.cancel_ticket(p_ticket_id uuid, p_reason text)
returns public.tickets
language plpgsql security definer set search_path = public as $$
declare
  t    public.tickets;
  role public.app_role := public.current_app_role();
begin
  select * into t from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'ticket_not_found' using errcode = 'P0002'; end if;
  if not (role in ('admin', 'supervisor') or (role = 'agent' and t.created_by = auth.uid())) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if t.status not in ('pending', 'answered') then
    raise exception 'ticket_already_final' using errcode = '22023';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  update public.tickets set status = 'cancelled', closed_at = now(), closed_by = auth.uid()
  where id = t.id returning * into t;

  insert into public.ticket_events (ticket_id, actor_id, event, payload)
  values (t.id, auth.uid(), 'cancelled', jsonb_build_object('reason', trim(p_reason)));

  perform public._notify_role('branch', t.branch_id, t.id, 'ticket_cancelled',
    'تيكت #' || t.ticket_no || ' اتلغى', trim(p_reason));
  return t;
end $$;

-- ---------------------------------------------------------------------
-- SLA: mark overdue requests and escalate to supervisors.
-- The ticket STAYS in the branch queue (flagged red); the branch can
-- still answer. Run every minute by pg_cron (migration 4).
-- ---------------------------------------------------------------------
create or replace function public.mark_sla_breaches()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    update public.tickets t
       set sla_breached_at = now()
     where t.kind = 'request' and t.status = 'pending'
       and t.sla_breached_at is null and t.sla_due_at <= now()
    returning t.id, t.ticket_no, t.branch_id
  loop
    n := n + 1;
    insert into public.ticket_events (ticket_id, event, payload)
    values (r.id, 'sla_breached', '{}'::jsonb);

    perform public._notify_role('supervisor', null, r.id, 'sla_breached',
      'تيكت #' || r.ticket_no || ' كسر الـ SLA',
      (select name_ar from public.branches where id = r.branch_id) || ' — لسه مردش');
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Convenience view for dashboards (respects RLS of underlying tables)
-- ---------------------------------------------------------------------
create view public.ticket_board
with (security_invoker = true) as
select
  t.*,
  b.name_ar          as branch_name,
  d.display_name     as doctor_name,
  s.name_ar          as service_name,
  p.full_name        as agent_name,
  (t.kind = 'request' and t.status = 'pending' and t.sla_due_at <= now()) as is_overdue,
  case when t.responded_at is not null
       then extract(epoch from (t.responded_at - t.created_at))::int end as response_seconds
from public.tickets t
join public.branches b on b.id = t.branch_id
join public.doctors  d on d.id = t.doctor_id
join public.services s on s.id = t.service_id
left join public.profiles p on p.id = t.created_by;
