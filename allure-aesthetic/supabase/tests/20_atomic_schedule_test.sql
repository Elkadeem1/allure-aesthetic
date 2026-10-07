-- =====================================================================
-- replace_doctor_schedule: atomic, and still bound by role/branch.
-- Runs after 10_workflow_and_rls_test.sql (reuses its fixtures).
-- =====================================================================
\set ON_ERROR_STOP 1

create or replace function pg_temp.doc(p_branch text, p_code text) returns uuid language sql as $$
  select d.id from doctors d join branches b on b.id = d.branch_id where b.code = p_branch and d.code = p_code
$$;

-- ---------- branch account (Tanta 1) ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
set role authenticated;

do $$
declare
  own   uuid := pg_temp.doc('tanta1', 'hebaghonim');
  other uuid := pg_temp.doc('tanta2', 'nohanoubir');
  other_before int;
begin
  perform replace_doctor_schedule(own, '[
    {"weekday": 0, "start_time": "10:00", "end_time": "14:00", "kind": "all"},
    {"weekday": 3, "start_time": "15:00", "end_time": "21:00", "kind": "laser"}
  ]'::jsonb);
  assert (select count(*) from doctor_schedules where doctor_id = own) = 2, 'own schedule replaced';

  -- second row is invalid (end <= start): nothing may change
  begin
    perform replace_doctor_schedule(own, '[
      {"weekday": 1, "start_time": "10:00", "end_time": "12:00", "kind": "all"},
      {"weekday": 2, "start_time": "18:00", "end_time": "09:00", "kind": "all"}
    ]'::jsonb);
    assert false, 'invalid entry must fail';
  exception when check_violation then null;
  end;
  assert (select count(*) from doctor_schedules where doctor_id = own) = 2
     and exists (select 1 from doctor_schedules where doctor_id = own and weekday = 3 and kind = 'laser'),
     'failed save rolled back — old schedule intact';

  -- another branch's doctor: rejected, untouched
  other_before := (select count(*) from doctor_schedules where doctor_id = other);
  begin
    perform replace_doctor_schedule(other, '[]'::jsonb);
    assert false, 'must not replace another branch schedule';
  exception when insufficient_privilege then null;
  end;
  reset role;
  assert (select count(*) from doctor_schedules where doctor_id = other) = other_before,
         'other branch schedule untouched';
  raise notice '✓ replace_doctor_schedule: branch atomic + isolated';
end $$;
reset role;

-- ---------- agent: not allowed ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
do $$
begin
  begin
    perform replace_doctor_schedule(pg_temp.doc('tanta1', 'hebaghonim'), '[]'::jsonb);
    assert false, 'agent must not replace schedules';
  exception when insufficient_privilege then null;
  end;
  raise notice '✓ replace_doctor_schedule: agent rejected';
end $$;
reset role;

-- ---------- admin: any branch ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
declare other uuid := pg_temp.doc('tanta2', 'nohanoubir');
begin
  perform replace_doctor_schedule(other, '[{"weekday": 5, "start_time": "11:00", "end_time": "19:00"}]'::jsonb);
  assert (select count(*) from doctor_schedules where doctor_id = other) = 1
     and (select kind from doctor_schedules where doctor_id = other) = 'all',
     'admin replaced other branch schedule (kind defaults to all)';
  raise notice '✓ replace_doctor_schedule: admin';
end $$;
reset role;

-- ---------- anon: no execute ----------
set role anon;
do $$
begin
  begin
    perform replace_doctor_schedule(gen_random_uuid(), '[]'::jsonb);
    assert false, 'anon must not execute';
  exception when insufficient_privilege then null;
  end;
  raise notice '✓ replace_doctor_schedule: anon has no execute';
end $$;
reset role;
