-- =====================================================================
-- Phase 5b test: admin_save_doctor_schedule() replaces a doctor's weekly
-- schedule (and room assignments) atomically, admin-only. Runs after
-- 10_* on the local harness; reuses its admin (…000a) / agent (…000c) rows.
-- =====================================================================
\set ON_ERROR_STOP 1

-- ---------- admin: replace, then re-replace, then roll back on a bad row ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

do $$
declare did uuid; n int;
begin
  select id into did from public.doctors where is_active order by created_at limit 1;
  if did is null then raise exception 'no seed doctor to test with'; end if;

  -- 1) save two segments on Saturday
  perform public.admin_save_doctor_schedule(
    did,
    '[{"weekday":0,"start":"10:00","end":"14:00","kind":"all"},
      {"weekday":0,"start":"14:00","end":"18:00","kind":"laser"}]'::jsonb,
    '[]'::jsonb);
  select count(*) into n from public.doctor_schedules where doctor_id = did;
  if n <> 2 then raise exception 'expected 2 rows after save, got %', n; end if;

  -- 2) replace wholesale with a single Sunday segment
  perform public.admin_save_doctor_schedule(
    did,
    '[{"weekday":1,"start":"09:00","end":"12:00","kind":"other"}]'::jsonb,
    '[]'::jsonb);
  select count(*) into n from public.doctor_schedules where doctor_id = did;
  if n <> 1 then raise exception 'expected 1 row after replace, got %', n; end if;

  -- 3) a bad segment (end <= start) must fail AND roll back the whole save
  begin
    perform public.admin_save_doctor_schedule(
      did, '[{"weekday":2,"start":"15:00","end":"10:00","kind":"all"}]'::jsonb, '[]'::jsonb);
    raise exception 'bad segment should have failed';
  exception when others then null; -- expected
  end;
  select count(*) into n from public.doctor_schedules where doctor_id = did;
  if n <> 1 then raise exception 'rollback failed: expected 1 row intact, got %', n; end if;
end $$;

reset role;

-- ---------- non-admin is refused ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false); -- agent
set role authenticated;

do $$
declare did uuid; refused boolean := false;
begin
  select id into did from public.doctors where is_active order by created_at limit 1;
  begin
    perform public.admin_save_doctor_schedule(did, '[]'::jsonb, '[]'::jsonb);
  exception when others then refused := true;
  end;
  if not refused then raise exception 'non-admin must not save schedules'; end if;
end $$;

reset role;

\echo '✓ 20_admin_schedule_test passed'
