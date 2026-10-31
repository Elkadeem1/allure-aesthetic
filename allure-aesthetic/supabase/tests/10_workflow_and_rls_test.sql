-- =====================================================================
-- Phase 1a tests: Innova-only tickets, today/tomorrow window, "full"
-- blocks, the new branch reply set, SLA escalation, and the admin-only
-- editing model (branch may only add/remove 'full' for its own branch).
-- Runs on the local harness (scripts/test-db.sh). Any failure aborts.
-- =====================================================================
\set ON_ERROR_STOP 1

-- ---------- fixtures (as superuser) ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@allure.test'),
  ('00000000-0000-0000-0000-00000000000b', 'ahmed.taher@allure.test'),
  ('00000000-0000-0000-0000-00000000000c', 'agent1@allure.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'innova@allure.test');

insert into public.profiles (id, full_name, role, branch_id) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', 'admin', null),
  ('00000000-0000-0000-0000-00000000000b', 'أحمد طاهر', 'supervisor', null),
  ('00000000-0000-0000-0000-00000000000c', 'Agent One', 'agent', null),
  ('00000000-0000-0000-0000-0000000000e1', 'فرع Innova', 'branch', (select id from branches where code = 'innova'));

create or replace function pg_temp.doc(p_branch text, p_code text) returns uuid language sql as $$
  select d.id from doctors d join branches b on b.id = d.branch_id where b.code = p_branch and d.code = p_code
$$;

-- ---------- 1. decision preview still computes (resolve_ticket_kind) ----------
do $$
declare r record;
begin
  -- Innova doctor is always Open -> today/tomorrow is a request.
  select * into r from resolve_ticket_kind(pg_temp.doc('innova', 'emankarawya'), cairo_today() + 1);
  assert r.kind = 'request' and r.dentolize_status = 'open', 'innova open tomorrow: ' || r.reason;
  -- A Confirmed doctor at another branch still previews as a notice.
  select * into r from resolve_ticket_kind(pg_temp.doc('tanta1', 'esraaabdelhamid'), cairo_today() + 1);
  assert r.kind = 'notice' and r.dentolize_status = 'confirmed', 'confirmed doctor: ' || r.reason;
  raise notice '✓ decision preview';
end $$;

-- ---------- 2. tickets are Innova-only, today/tomorrow only ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
do $$
declare t tickets;
begin
  -- a non-Innova branch has no tickets at all
  begin
    perform create_ticket(pg_temp.doc('tanta1', 'esraaabdelhamid'), 'botox', 'سارة', '01012345678',
                          'female', '{}', cairo_today(), '12:00', '12:30');
    assert false, 'non-Innova ticket must be rejected';
  exception when sqlstate '22023' then
    assert sqlerrm = 'tickets_not_enabled_for_branch', sqlerrm;
  end;

  -- Innova today -> request with SLA
  t := create_ticket(pg_temp.doc('innova', 'emankarawya'), 'botox', 'سارة أحمد', '01012345678',
                     'female', '{}', cairo_today(), '12:00', '12:30', 'أول مرة');
  assert t.kind = 'request' and t.status = 'pending' and t.sla_due_at is not null, 'innova request created';
  perform set_config('test.req_id', t.id::text, false);

  -- Innova, day after tomorrow -> rejected (window is today/tomorrow only)
  begin
    perform create_ticket(pg_temp.doc('innova', 'emankarawya'), 'botox', 'سارة', '01012345678',
                          'female', '{}', cairo_today() + 2, '12:00', '12:30');
    assert false, 'ticket beyond tomorrow must be rejected';
  exception when sqlstate '22023' then
    assert sqlerrm = 'ticket_only_today_tomorrow', sqlerrm;
  end;

  -- agent still cannot write tickets directly nor run the SLA job
  begin
    insert into tickets (kind, kind_reason, dentolize_status, branch_id, doctor_id, service_id,
      customer_name, customer_phone, customer_gender, appt_date, start_time, end_time, created_by)
    values ('notice', 'x', 'open', t.branch_id, t.doctor_id, t.service_id, 'x', '0100000000', 'female',
      cairo_today(), '10:00', '10:30', auth.uid());
    assert false, 'direct insert should fail';
  exception when insufficient_privilege then null; end;
  raise notice '✓ Innova-only tickets, today/tomorrow window';
end $$;
reset role;

-- ---------- 3. "full" blocks per doctor and per whole branch ----------
-- admin marks one doctor fully booked today, and the whole branch tomorrow
insert into doctor_updates (doctor_id, type, date_from, date_to, note)
values (pg_temp.doc('innova', 'tasneem'), 'full', cairo_today(), cairo_today(), 'الحجز اكتمل');
insert into doctor_updates (branch_id, doctor_id, type, date_from, date_to, note)
values ((select id from branches where code = 'innova'), null, 'full', cairo_today() + 1, cairo_today() + 1, 'الفرع اكتمل');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
do $$
begin
  -- per-doctor full: that doctor is blocked today
  begin
    perform create_ticket(pg_temp.doc('innova', 'tasneem'), 'botox', 'منى', '01099999999',
                          'female', '{}', cairo_today(), '12:00', '12:30');
    assert false, 'doctor fully booked today';
  exception when sqlstate '22023' then assert sqlerrm = 'fully_booked', sqlerrm; end;

  -- per-branch full: a DIFFERENT doctor is blocked tomorrow
  begin
    perform create_ticket(pg_temp.doc('innova', 'ayat'), 'botox', 'منى', '01099999999',
                          'female', '{}', cairo_today() + 1, '12:00', '12:30');
    assert false, 'branch fully booked tomorrow';
  exception when sqlstate '22023' then assert sqlerrm = 'fully_booked', sqlerrm; end;
  raise notice '✓ full blocks per doctor and per branch';
end $$;
reset role;

-- ---------- 4. Innova branch answers (offered / full / confirmed) ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
do $$
declare t tickets;
begin
  assert (select count(*) from tickets) = 1, 'Innova branch sees its own ticket';

  -- old response values are rejected
  begin
    perform branch_respond(current_setting('test.req_id')::uuid, 'agent_confirm');
    assert false, 'old response value must be rejected';
  exception when sqlstate '22023' then assert sqlerrm = 'invalid_response', sqlerrm; end;

  -- "offered" needs a time
  begin
    perform branch_respond(current_setting('test.req_id')::uuid, 'offered', 'علاء');
    assert false, 'offered needs a time';
  exception when sqlstate '22023' then assert sqlerrm = 'offered_needs_time', sqlerrm; end;

  -- offered with a time -> answered
  t := branch_respond(current_setting('test.req_id')::uuid, 'offered', 'علاء', 'ساعة فاضية', '13:30');
  assert t.status = 'answered' and t.branch_response::text = 'offered'
     and t.offered_time = '13:30'::time, 'offered recorded';

  -- cannot answer twice
  begin
    perform branch_respond(t.id, 'confirmed', 'علاء');
    assert false, 'cannot answer twice';
  exception when sqlstate '22023' then null; end;
  raise notice '✓ branch answers offered/full/confirmed';
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
  raise notice '✓ agent closes the loop';
end $$;
reset role;

-- ---------- 6. SLA breach -> stays in branch queue + supervisor alert ----------
-- new pending Innova request, then force it overdue
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
do $$
declare t tickets;
begin
  -- today (emankarawya is not blocked today; the branch-wide full is tomorrow)
  t := create_ticket(pg_temp.doc('innova', 'emankarawya'), 'botox', 'هبة', '01155555555',
                     'female', '{}', cairo_today(), '17:00', '17:30');
  perform set_config('test.sla_id', t.id::text, false);
end $$;
reset role;

update tickets set sla_due_at = now() - interval '1 minute' where id = current_setting('test.sla_id')::uuid;
do $$
begin
  assert mark_sla_breaches() = 1, 'one breach';
  assert mark_sla_breaches() = 0, 'breach marked only once';
  assert exists (select 1 from notifications
                 where user_id = '00000000-0000-0000-0000-00000000000b' and kind = 'sla_breached'),
         'supervisor notified';
  raise notice '✓ SLA breach escalated (Innova)';
end $$;

-- ---------- 7. admin-only editing; branch may only add/remove 'full' ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
do $$
declare uid uuid;
begin
  -- branch CAN add a 'full' update for its own doctor ...
  insert into doctor_updates (doctor_id, type, date_from, date_to, note, created_by)
  values (pg_temp.doc('innova', 'omarawad'), 'full', cairo_today(), cairo_today(), 'اكتمل', auth.uid())
  returning id into uid;
  -- ... and for the whole branch ...
  insert into doctor_updates (branch_id, doctor_id, type, date_from, date_to, created_by)
  values (current_branch_id(), null, 'full', cairo_today() + 1, cairo_today() + 1, auth.uid());
  -- ... and remove its own 'full'
  delete from doctor_updates where id = uid;

  -- branch CANNOT add any other update type
  begin
    insert into doctor_updates (doctor_id, type, date_from, date_to, created_by)
    values (pg_temp.doc('innova', 'omarawad'), 'off', cairo_today(), cairo_today(), auth.uid());
    assert false, 'branch may not add non-full updates';
  exception when insufficient_privilege then null; end;

  -- branch CANNOT mark another branch's doctor full (branch_id is forced from the doctor)
  begin
    insert into doctor_updates (doctor_id, type, date_from, date_to, created_by)
    values (pg_temp.doc('tanta1', 'hebaghonim'), 'full', cairo_today(), cairo_today(), auth.uid());
    assert false, 'branch may not touch another branch';
  exception when insufficient_privilege then null; end;

  -- branch CANNOT edit weekly schedules anymore
  begin
    insert into doctor_schedules (doctor_id, weekday, start_time, end_time, kind)
    values (pg_temp.doc('innova', 'emankarawya'), 4, '10:00', '14:00', 'all');
    assert false, 'branch may not edit schedules';
  exception when insufficient_privilege then null; end;

  -- branch CANNOT edit prices
  begin
    update price_items set sort = sort + 1 where code = 'FIL-01';
    assert not found, 'branch price update must affect nothing (RLS)';
  end;
  begin
    insert into price_item_branch_prices (item_id, branch_id, price)
    values ((select id from price_items where code = 'FIL-01'), current_branch_id(), 1);
    assert false, 'branch may not write prices';
  exception when insufficient_privilege then null; end;
  raise notice '✓ branch: only add/remove its own full; no schedule/price edits';
end $$;
reset role;

-- ---------- 8. admin CAN edit prices ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
begin
  update price_items set sort = sort where code = 'FIL-01';
  assert found, 'admin can edit price items';
  update price_item_branch_prices set price = price
   where item_id = (select id from price_items where code = 'FIL-01');
  raise notice '✓ admin can edit prices';
end $$;
reset role;

do $$ begin raise notice '✓✓ all phase-1a tests passed'; end $$;
