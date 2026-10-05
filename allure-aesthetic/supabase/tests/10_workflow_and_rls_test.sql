-- =====================================================================
-- Phase 1 tests: ticket decision, workflow, SLA escalation, RLS.
-- Runs on the local harness (scripts/test-db.sh). Any failure aborts.
-- =====================================================================
\set ON_ERROR_STOP 1

-- ---------- fixtures (as superuser) ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@allure.test'),
  ('00000000-0000-0000-0000-00000000000b', 'ahmed.taher@allure.test'),
  ('00000000-0000-0000-0000-00000000000c', 'agent1@allure.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'tanta1@allure.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'tanta2@allure.test');

insert into public.profiles (id, full_name, role, branch_id) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', 'admin', null),
  ('00000000-0000-0000-0000-00000000000b', 'أحمد طاهر', 'supervisor', null),
  ('00000000-0000-0000-0000-00000000000c', 'Agent One', 'agent', null),
  ('00000000-0000-0000-0000-0000000000d1', 'فرع طنطا ١', 'branch', (select id from branches where code = 'tanta1')),
  ('00000000-0000-0000-0000-0000000000d2', 'فرع طنطا ٢', 'branch', (select id from branches where code = 'tanta2'));

create or replace function pg_temp.doc(p_branch text, p_code text) returns uuid language sql as $$
  select d.id from doctors d join branches b on b.id = d.branch_id where b.code = p_branch and d.code = p_code
$$;
-- next date (from today, inclusive) that is NOT a Saturday, within N days
create or replace function pg_temp.non_sat(p_from_offset int) returns date language sql as $$
  select d from generate_series(cairo_today() + p_from_offset, cairo_today() + p_from_offset + 7, '1 day') g(d0),
       lateral (select d0::date as d) x
  where weekday_sat0(d) <> 0 order by d limit 1
$$;

-- ---------- 1. decision: request vs notice ----------
do $$
declare r record; dt date;
begin
  -- Open doctor (Heba, Tanta 1) tomorrow -> request unless tomorrow is Saturday
  dt := cairo_today() + 1;
  select * into r from resolve_ticket_kind(pg_temp.doc('tanta1', 'hebaghonim'), dt);
  if weekday_sat0(dt) = 0 then
    assert r.kind = 'notice' and r.reason = 'auto_confirm_weekday', 'Sat auto-confirm: ' || r.reason;
  else
    assert r.kind = 'request' and r.dentolize_status = 'open', 'open doctor in window: ' || r.reason;
  end if;

  -- Open doctor, later day (non-Saturday) -> NO ticket, booked Open
  select * into r from resolve_ticket_kind(pg_temp.doc('tanta1', 'hebaghonim'), pg_temp.non_sat(5));
  assert r.kind is null and r.dentolize_status = 'open', 'later day, no ticket: ' || r.reason;

  -- Confirmed doctor -> notice/confirmed
  select * into r from resolve_ticket_kind(pg_temp.doc('tanta1', 'esraaabdelhamid'), cairo_today() + 1);
  assert r.kind = 'notice' and r.dentolize_status = 'confirmed', 'confirmed doctor: ' || r.reason;

  -- Tanta 2: same day always needs the branch, even for a Confirmed doctor
  select * into r from resolve_ticket_kind(pg_temp.doc('tanta2', 'nohanoubir'), cairo_today());
  assert r.kind = 'request' and r.reason = 'same_day_branch_rule', 'tanta2 same day: ' || r.reason;
  raise notice '✓ decision rules';
end $$;

-- ---------- 2. agent creates a REQUEST ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;

do $$
declare t tickets; dt date := pg_temp.non_sat(1);
begin
  -- force a request: use tomorrow if not Saturday, else rely on Tanta 2 same-day rule
  if dt = cairo_today() + 1 then
    t := create_ticket(pg_temp.doc('tanta1', 'hebaghonim'), 'laser', 'سارة أحمد', '01012345678',
                       'female', array['w_fullarms'], dt, '12:00', '12:30', 'أول مرة');
  else
    t := create_ticket(pg_temp.doc('tanta2', 'nohanoubir'), 'laser', 'سارة أحمد', '01012345678',
                       'female', array['w_fullarms'], cairo_today(), '12:00', '12:30', 'أول مرة');
  end if;
  assert t.kind = 'request' and t.status = 'pending' and t.sla_due_at is not null, 'request created';
  perform set_config('test.req_id', t.id::text, false);
  perform set_config('test.req_branch', (select code from branches where id = t.branch_id), false);

  -- Heba does not take men
  begin
    perform create_ticket(pg_temp.doc('tanta1', 'hebaghonim'), 'laser', 'محمد', '01099999999',
                          'male', array['m_beard'], cairo_today() + 1, '12:00', '12:15');
    assert false, 'male booking with Heba should fail';
  exception when sqlstate '22023' then null; end;

  -- agent cannot write tickets directly or run the SLA job
  begin
    insert into tickets (kind, kind_reason, dentolize_status, branch_id, doctor_id, service_id,
      customer_name, customer_phone, customer_gender, appt_date, start_time, end_time, created_by)
    values ('notice', 'x', 'open', t.branch_id, t.doctor_id, t.service_id, 'x', '0100000000', 'female',
      cairo_today(), '10:00', '10:30', auth.uid());
    assert false, 'direct insert should fail';
  exception when insufficient_privilege then null; end;
  begin
    perform mark_sla_breaches();
    assert false, 'agent must not run SLA job';
  exception when insufficient_privilege then null; end;
  raise notice '✓ agent creates request; guards hold';
end $$;
reset role;

-- ---------- 3. branch isolation ----------
-- the OTHER branch sees nothing
select set_config('request.jwt.claim.sub',
  case current_setting('test.req_branch') when 'tanta1'
       then '00000000-0000-0000-0000-0000000000d2' else '00000000-0000-0000-0000-0000000000d1' end, false);
set role authenticated;
do $$
begin
  assert (select count(*) from tickets) = 0, 'other branch must not see the ticket';
  assert (select count(*) from ticket_events) = 0, 'other branch must not see events';
  begin
    perform branch_respond(current_setting('test.req_id')::uuid, 'agent_confirm');
    assert false, 'other branch must not respond';
  exception when insufficient_privilege then null; end;
  raise notice '✓ other branch isolated';
end $$;
reset role;

-- ---------- 4. SLA breach -> stays in branch queue + supervisor alert ----------
update tickets set sla_due_at = now() - interval '1 minute' where id = current_setting('test.req_id')::uuid;
do $$
begin
  assert mark_sla_breaches() = 1, 'one breach';
  assert mark_sla_breaches() = 0, 'breach marked only once';
  assert exists (select 1 from notifications
                 where user_id = '00000000-0000-0000-0000-00000000000b' and kind = 'sla_breached'),
         'supervisor notified';
  raise notice '✓ SLA breach escalated';
end $$;

-- the owning branch still sees it (overdue) and answers late
select set_config('request.jwt.claim.sub',
  case current_setting('test.req_branch') when 'tanta1'
       then '00000000-0000-0000-0000-0000000000d1' else '00000000-0000-0000-0000-0000000000d2' end, false);
set role authenticated;
do $$
declare t tickets;
begin
  assert (select is_overdue from ticket_board where id = current_setting('test.req_id')::uuid), 'overdue in queue';
  assert exists (select 1 from notifications where kind = 'new_ticket'), 'branch got new_ticket notification';
  t := branch_respond(current_setting('test.req_id')::uuid, 'agent_confirm', 'منى', 'الدور فاضي');
  assert t.status = 'answered' and t.responder_name = 'منى', 'answered';
  begin
    perform branch_respond(t.id, 'unavailable');
    assert false, 'cannot answer twice';
  exception when sqlstate '22023' then null; end;
  raise notice '✓ branch answers late';
end $$;
reset role;

-- ---------- 5. agent closes the loop ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
do $$
declare t tickets;
begin
  assert exists (select 1 from notifications where kind = 'ticket_answered'), 'agent notified of answer';
  t := close_ticket(current_setting('test.req_id')::uuid, 'customer_confirmed');
  assert t.status = 'closed' and t.outcome = 'customer_confirmed', 'closed';
  assert (select count(*) from ticket_events where ticket_id = t.id) = 4,
         'events: created, sla_breached, responded, closed';
  assert (select (payload->>'late')::boolean from ticket_events where ticket_id = t.id and event = 'responded'),
         'late response recorded';

  -- NOTICE for a Confirmed doctor
  t := create_ticket(pg_temp.doc('tanta1', 'esraaabdelhamid'), 'botox', 'هبة', '01155555555',
                     'female', '{}', pg_temp.non_sat(2), '17:00', '17:30');
  assert t.kind = 'notice' and t.sla_due_at is null, 'notice has no SLA';
  perform set_config('test.notice_id', t.id::text, false);
  raise notice '✓ agent closes request; notice created';
end $$;
reset role;

-- ---------- 6. branch acknowledges notice + writes its own updates ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
do $$
declare t tickets;
begin
  t := acknowledge_notice(current_setting('test.notice_id')::uuid, 'هايدي');
  assert t.status = 'closed' and t.outcome = 'notice_acknowledged', 'acknowledged';

  insert into doctor_updates (doctor_id, type, date_from, date_to, note, created_by)
  values (pg_temp.doc('tanta1', 'hebaghonim'), 'off', cairo_today() + 3, cairo_today() + 3, 'إجازة مفاجئة', auth.uid());

  begin
    insert into doctor_updates (doctor_id, type, date_from, date_to, created_by)
    values (pg_temp.doc('tanta2', 'nohanoubir'), 'off', cairo_today(), cairo_today(), auth.uid());
    assert false, 'branch must not write another branch''s update';
  exception when insufficient_privilege then null; end;
  raise notice '✓ branch acknowledges notice and manages its own updates';
end $$;
reset role;

-- ---------- 7. agent is blocked by the "off" update; open_slot flips the decision ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
do $$
declare r record;
begin
  begin
    perform create_ticket(pg_temp.doc('tanta1', 'hebaghonim'), 'laser', 'نهى', '01077777777',
                          'female', array['w_face'], cairo_today() + 3, '12:00', '12:15');
    assert false, 'doctor is off that day';
  exception when sqlstate '22023' then null; end;
  begin
    insert into doctor_updates (doctor_id, type, date_from, date_to, created_by)
    values (pg_temp.doc('tanta1', 'hebaghonim'), 'off', cairo_today(), cairo_today(), auth.uid());
    assert false, 'agents cannot write updates';
  exception when insufficient_privilege then null; end;
  raise notice '✓ off-update blocks booking; agents cannot write updates';
end $$;
reset role;

insert into doctor_updates (doctor_id, type, date_from, date_to, note)
values (pg_temp.doc('tanta1', 'hebaghonim'), 'open_slot', cairo_today() + 1, cairo_today() + 1, 'الدور فاضي');
do $$
declare r record;
begin
  select * into r from resolve_ticket_kind(pg_temp.doc('tanta1', 'hebaghonim'), cairo_today() + 1);
  assert r.kind = 'notice' and r.dentolize_status = 'confirmed', 'open_slot flips to confirmed: ' || r.reason;
  raise notice '✓ "الدور فاضي" update flips Open -> Confirmed';
end $$;

-- =====================================================================
-- Migration 5: branch self-service + "no ticket" for later Open days
-- =====================================================================
update notifications set read_at = now();  -- clean slate for notification checks

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
do $$
declare r record;
begin
  -- branch flips a Confirmed doctor to Open for today -> REQUEST
  insert into doctor_updates (doctor_id, type, date_from, date_to, note, created_by)
  values (pg_temp.doc('tanta1', 'esraaabdelhamid'), 'force_open', cairo_today(), cairo_today(), 'الدكتورة طلبت تأكيد', auth.uid());
  select * into r from resolve_ticket_kind(pg_temp.doc('tanta1', 'esraaabdelhamid'), cairo_today());
  assert r.kind = 'request' and r.reason = 'confirmed_turned_open', 'force_open today: ' || r.reason;

  -- status change allowed only for today/tomorrow
  begin
    insert into doctor_updates (doctor_id, type, date_from, date_to, created_by)
    values (pg_temp.doc('tanta1', 'esraaabdelhamid'), 'open_slot', cairo_today() + 3, cairo_today() + 3, auth.uid());
    assert false, 'status change beyond tomorrow must fail';
  exception when sqlstate '22023' then null; end;

  -- branch-wide: fully booked in 2 days
  insert into doctor_updates (branch_id, doctor_id, type, date_from, date_to, note, created_by)
  values (current_branch_id(), null, 'stop', cairo_today() + 2, cairo_today() + 2, 'Event في الفرع', auth.uid());

  -- edit own doctor's weekly schedule
  insert into doctor_schedules (doctor_id, weekday, start_time, end_time, kind)
  values (pg_temp.doc('tanta1', 'esraaabdelhamid'), 4, '10:00', '14:00', 'all');
  begin
    insert into doctor_schedules (doctor_id, weekday, start_time, end_time, kind)
    values (pg_temp.doc('tanta2', 'nohanoubir'), 4, '10:00', '14:00', 'all');
    assert false, 'must not edit another branch schedule';
  exception when insufficient_privilege then null; end;
  begin
    update doctors set accepts_men = true where id = pg_temp.doc('tanta1', 'hebaghonim');
    assert not found, 'branch must not edit doctor rules';
  end;
  raise notice '✓ branch: status flip, branch-wide stop, own schedule edits';
end $$;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
do $$
begin
  begin
    perform create_ticket(pg_temp.doc('tanta1', 'esraaabdelhamid'), 'botox', 'ريم', '01066666666',
                          'female', '{}', cairo_today() + 2, '17:00', '17:30');
    assert false, 'branch fully booked that day';
  exception when sqlstate '22023' then
    assert sqlerrm = 'branch_unavailable_on_date', sqlerrm;
  end;
  begin
    perform create_ticket(pg_temp.doc('tanta1', 'hebaghonim'), 'laser', 'ريم', '01066666666',
                          'female', array['w_face'], pg_temp.non_sat(5), '12:00', '12:15');
    assert false, 'later Open day needs no ticket';
  exception when sqlstate '22023' then
    assert sqlerrm = 'no_ticket_needed', sqlerrm;
  end;
  assert (select count(*) from notifications where kind = 'branch_update' and read_at is null) = 2,
         'agent notified of 2 branch updates';
  assert (select count(*) from notifications where kind = 'schedule_changed' and read_at is null) = 1,
         'agent notified once of schedule change';
  assert (select not accepts_men from doctors where id = pg_temp.doc('tanta1', 'hebaghonim')), 'doctor rules unchanged';
  raise notice '✓ agent: blocked by branch-wide stop, no ticket for later Open days, notified';
end $$;
reset role;
