-- =====================================================================
-- Allure Aesthetic — Migration 6: atomic weekly-schedule replace
--
-- Saving a doctor's weekly schedule used to be two client calls
-- (delete all rows, then insert the new ones). If the insert failed the
-- doctor was left with no schedule and disappeared from booking.
-- This function does both in one transaction.
--
-- SECURITY INVOKER: the caller's RLS still applies to every row
-- (admin write policy / doctor_schedules_branch_write). The explicit
-- check below only turns a silent RLS no-op into a clear error.
-- =====================================================================

create or replace function public.replace_doctor_schedule(
  p_doctor_id uuid,
  p_entries   jsonb
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  role       public.app_role := public.current_app_role();
  doc_branch uuid;
begin
  select d.branch_id into doc_branch from public.doctors d where d.id = p_doctor_id;
  if not found then raise exception 'doctor_not_found' using errcode = 'P0002'; end if;

  if not (role = 'admin' or (role = 'branch' and doc_branch = public.current_branch_id())) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  delete from public.doctor_schedules where doctor_id = p_doctor_id;

  insert into public.doctor_schedules (doctor_id, weekday, start_time, end_time, kind)
  select p_doctor_id,
         (e ->> 'weekday')::smallint,
         (e ->> 'start_time')::time,
         (e ->> 'end_time')::time,
         coalesce(e ->> 'kind', 'all')::public.shift_kind
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as e;
end $$;

revoke execute on function public.replace_doctor_schedule(uuid, jsonb) from public, anon;
grant  execute on function public.replace_doctor_schedule(uuid, jsonb) to authenticated;
