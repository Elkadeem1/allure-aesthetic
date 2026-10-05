-- =====================================================================
-- Allure Aesthetic — Migration 5: branch self-service + final ticket rules
--
-- Client decisions (2026-10-04):
--   * Confirmed doctor                        -> NOTICE ticket
--   * Open doctor, today or tomorrow          -> REQUEST ticket (branch must answer)
--   * Open doctor, any later day              -> NO ticket (booked Open in Dentolize)
--   * The branch can flip a doctor's status for TODAY / TOMORROW
--     (open_slot = book Confirmed, force_open = book Open). The assistant
--     follows it automatically and agents get a notification.
--   * The branch edits its own data: doctors' weekly schedules, and
--     branch-wide availability for a day (fully booked / event / closed).
--   * Every branch change notifies agents + supervisors.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) New update type: force_open (book Open instead of Confirmed)
-- ---------------------------------------------------------------------
alter type public.update_type add value if not exists 'force_open';

-- ---------------------------------------------------------------------
-- 2) Branch-wide updates: doctor_id is optional.
--    doctor_id null  -> applies to the whole branch (off = closed / event,
--                       stop = fully booked, note = banner)
-- ---------------------------------------------------------------------
alter table public.doctor_updates alter column doctor_id drop not null;

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

  if new.doctor_id is null and new.type::text not in ('off', 'stop', 'note') then
    raise exception 'branch-wide updates can only be off, stop or note' using errcode = '22023';
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
-- 3) The decision, final version. kind = null means "no ticket".
-- ---------------------------------------------------------------------
create or replace function public.effective_booking_status(p_doctor_id uuid, p_date date)
returns public.booking_status
language plpgsql stable security definer set search_path = public as $$
declare
  d   public.doctors;
  pol public.branch_policies;
  ov  text;
begin
  select * into d from public.doctors where id = p_doctor_id;
  if not found then raise exception 'doctor_not_found' using errcode = 'P0002'; end if;

  -- Latest status override from the branch wins.
  select u.type::text into ov
  from public.doctor_updates u
  where u.doctor_id = d.id and u.type::text in ('open_slot', 'force_open')
    and p_date between u.date_from and u.date_to
  order by u.created_at desc limit 1;

  if ov = 'open_slot'  then return 'confirmed'; end if;
  if ov = 'force_open' then return 'open'; end if;

  if d.default_booking_status = 'open' then
    select * into pol from public.branch_policies where branch_id = d.branch_id;
    if public.weekday_sat0(p_date) = any (coalesce(pol.auto_confirm_weekdays, '{}')) then
      return 'confirmed';
    end if;
  end if;
  return d.default_booking_status;
end $$;

create or replace function public.resolve_ticket_kind(p_doctor_id uuid, p_date date)
returns table (kind public.ticket_kind, dentolize_status public.booking_status, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  d      public.doctors;
  pol    public.branch_policies;
  diff   integer := p_date - public.cairo_today();
  status public.booking_status;
begin
  select * into d from public.doctors where id = p_doctor_id;
  if not found then raise exception 'doctor_not_found' using errcode = 'P0002'; end if;
  select * into pol from public.branch_policies where branch_id = d.branch_id;

  if coalesce(pol.same_day_always_request, false) and diff = 0 then
    return query select 'request'::public.ticket_kind, 'open'::public.booking_status, 'same_day_branch_rule';
    return;
  end if;

  status := public.effective_booking_status(d.id, p_date);

  if status = 'confirmed' then
    return query select 'notice'::public.ticket_kind, 'confirmed'::public.booking_status,
      case when d.default_booking_status = 'open' then 'open_turned_confirmed' else 'doctor_confirmed' end;
    return;
  end if;

  if diff <= coalesce(pol.request_window_days, 1) then
    return query select 'request'::public.ticket_kind, 'open'::public.booking_status,
      case when d.default_booking_status = 'confirmed' then 'confirmed_turned_open' else 'open_doctor_today_tomorrow' end;
    return;
  end if;

  -- Open doctor, later day: book Open in Dentolize, no ticket.
  return query select null::public.ticket_kind, 'open'::public.booking_status, 'open_later_no_ticket';
end $$;

-- ---------------------------------------------------------------------
-- 4) Is the doctor (or the whole branch) blocked on a date?
-- ---------------------------------------------------------------------
create or replace function public.blocking_update(p_doctor_id uuid, p_date date)
returns public.doctor_updates
language sql stable security definer set search_path = public as $$
  select u.* from public.doctor_updates u
  join public.doctors d on d.id = p_doctor_id
  where u.type::text in ('off', 'stop')
    and p_date between u.date_from and u.date_to
    and (u.doctor_id = d.id or (u.doctor_id is null and u.branch_id = d.branch_id))
  order by u.doctor_id nulls first
  limit 1
$$;

-- create_ticket: same as before + branch-wide blocks + "no ticket" case
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
  svc  public.services;
  blk  public.doctor_updates;
  dec  record;
  sla  integer;
  t    public.tickets;
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

  blk := public.blocking_update(d.id, p_appt_date);
  if blk.id is not null then
    raise exception '%', case when blk.doctor_id is null then 'branch_unavailable_on_date'
                              else 'doctor_unavailable_on_date' end
      using errcode = '22023', detail = coalesce(blk.note, '');
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

-- ---------------------------------------------------------------------
-- 5) Branch edits its doctors' weekly schedules
-- ---------------------------------------------------------------------
create policy doctor_schedules_branch_write on public.doctor_schedules
  for all to authenticated
  using (public.current_app_role() = 'branch'
         and exists (select 1 from public.doctors d
                     where d.id = doctor_id and d.branch_id = public.current_branch_id()))
  with check (public.current_app_role() = 'branch'
              and exists (select 1 from public.doctors d
                          where d.id = doctor_id and d.branch_id = public.current_branch_id()));

-- ---------------------------------------------------------------------
-- 6) Notify agents + supervisors about every branch change.
--    De-duplicated: one unread notification per subject per 2 minutes,
--    so editing a week of shifts does not spam 10 alerts.
-- ---------------------------------------------------------------------
create or replace function public._notify_call_center(p_kind text, p_title text, p_body text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body)
  select p.id, p_kind, p_title, p_body
  from public.profiles p
  where p.is_active and p.role in ('agent', 'supervisor')
    and not exists (
      select 1 from public.notifications n
      where n.user_id = p.id and n.kind = p_kind and n.title = p_title
        and n.read_at is null and n.created_at > now() - interval '2 minutes')
$$;
revoke execute on function public._notify_call_center(text, text, text) from public, anon, authenticated;

create or replace function public.trg_notify_doctor_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  u      public.doctor_updates := coalesce(new, old);
  who    text;
  label  text;
  period text;
begin
  select coalesce((select display_name from public.doctors where id = u.doctor_id), 'الفرع كله')
         || ' — ' || (select name_ar from public.branches where id = u.branch_id)
    into who;
  label := case u.type::text
    when 'off'        then case when u.doctor_id is null then 'الفرع مقفول / Event' else 'غايبة' end
    when 'stop'       then case when u.doctor_id is null then 'الحجز مكتمل' else 'وقف حجز' end
    when 'hours'      then 'ساعات مختلفة'
    when 'open_slot'  then 'الحالة اتغيرت لـ Confirmed'
    when 'force_open' then 'الحالة اتغيرت لـ Open'
    else 'ملاحظة' end;
  period := to_char(u.date_from, 'DD/MM')
         || case when u.date_to <> u.date_from then ' → ' || to_char(u.date_to, 'DD/MM') else '' end;

  perform public._notify_call_center('branch_update',
    case when tg_op = 'DELETE' then 'اتلغى Update: ' else 'Update: ' end || who,
    label || ' — ' || period || coalesce(' — ' || u.note, ''));
  return null;
end $$;

create trigger trg_doctor_updates_notify
  after insert or update or delete on public.doctor_updates
  for each row execute function public.trg_notify_doctor_update();

create or replace function public.trg_notify_schedule_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.doctor_schedules := coalesce(new, old);
begin
  perform public._notify_call_center('schedule_changed',
    'اتعدل جدول ' || d.display_name || ' — ' || b.name_ar,
    'راجع جدول الدكاترة قبل الحجز')
  from public.doctors d join public.branches b on b.id = d.branch_id
  where d.id = s.doctor_id;
  return null;
end $$;

create trigger trg_doctor_schedules_notify
  after insert or update or delete on public.doctor_schedules
  for each row execute function public.trg_notify_schedule_change();

-- ---------------------------------------------------------------------
-- 7) Realtime for schedules too
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and tablename = 'doctor_schedules') then
    alter publication supabase_realtime add table public.doctor_schedules;
  end if;
end $$;
