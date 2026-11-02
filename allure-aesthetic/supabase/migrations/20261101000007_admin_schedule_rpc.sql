-- =====================================================================
-- Migration 7: admin panel support (Phase 5b)
--   * rooms.is_active so rooms can be deactivated (not deleted — doctor_rooms
--     and ticket history may reference them).
--   * admin_save_doctor_schedule(): atomically replace a doctor's weekly
--     schedule AND room assignments in one transaction, so a save is never
--     half-applied. Admin-only (checked inside; SECURITY DEFINER).
-- =====================================================================

alter table public.rooms
  add column if not exists is_active boolean not null default true;

create or replace function public.admin_save_doctor_schedule(
  p_doctor_id uuid,
  p_segments  jsonb,
  p_rooms     jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  seg jsonb;
  rm  jsonb;
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.doctors where id = p_doctor_id) then
    raise exception 'doctor_not_found' using errcode = 'P0002';
  end if;

  -- Replace the weekly schedule.
  delete from public.doctor_schedules where doctor_id = p_doctor_id;
  for seg in select * from jsonb_array_elements(coalesce(p_segments, '[]'::jsonb)) loop
    insert into public.doctor_schedules (doctor_id, weekday, start_time, end_time, kind)
    values (
      p_doctor_id,
      (seg->>'weekday')::smallint,
      (seg->>'start')::time,
      (seg->>'end')::time,
      (seg->>'kind')::public.shift_kind
    );
  end loop;

  -- Replace the per-weekday room assignments.
  delete from public.doctor_rooms where doctor_id = p_doctor_id;
  for rm in select * from jsonb_array_elements(coalesce(p_rooms, '[]'::jsonb)) loop
    insert into public.doctor_rooms (doctor_id, weekday, room_id)
    values (p_doctor_id, (rm->>'weekday')::smallint, (rm->>'roomId')::uuid);
  end loop;
end $$;

revoke execute on function public.admin_save_doctor_schedule(uuid, jsonb, jsonb) from public, anon;
grant  execute on function public.admin_save_doctor_schedule(uuid, jsonb, jsonb) to authenticated;
