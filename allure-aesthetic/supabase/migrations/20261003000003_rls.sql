-- =====================================================================
-- Allure Aesthetic — Phase 1 / Migration 3: Row Level Security
--
--   admin       everything (read + write all reference data)
--   supervisor  reads everything, cancels tickets, gets SLA alerts
--   agent       reads everything, creates/closes tickets via RPCs
--   branch      reads reference data; sees ONLY its own branch tickets;
--               writes doctor_updates for its own branch only
--
-- Ticket tables have no client write policies: every change goes
-- through the SECURITY DEFINER RPCs in migration 2.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------
alter table public.app_settings          enable row level security;
alter table public.price_lists           enable row level security;
alter table public.branches              enable row level security;
alter table public.branch_policies       enable row level security;
alter table public.branch_laser_cutoffs  enable row level security;
alter table public.services              enable row level security;
alter table public.branch_services       enable row level security;
alter table public.laser_areas           enable row level security;
alter table public.laser_area_conflicts  enable row level security;
alter table public.laser_area_combos     enable row level security;
alter table public.doctors               enable row level security;
alter table public.doctor_schedules      enable row level security;
alter table public.doctor_laser_cutoffs  enable row level security;
alter table public.doctor_updates        enable row level security;
alter table public.consultation_prices   enable row level security;
alter table public.price_categories      enable row level security;
alter table public.price_items           enable row level security;
alter table public.laser_price_map       enable row level security;
alter table public.kb_articles           enable row level security;
alter table public.profiles              enable row level security;
alter table public.tickets               enable row level security;
alter table public.ticket_events         enable row level security;
alter table public.notifications         enable row level security;

-- ---------------------------------------------------------------------
-- Reference data: any active signed-in user reads; admin writes
-- ---------------------------------------------------------------------
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'app_settings', 'price_lists', 'branches', 'branch_policies', 'branch_laser_cutoffs',
    'services', 'branch_services', 'laser_areas', 'laser_area_conflicts', 'laser_area_combos',
    'doctors', 'doctor_schedules', 'doctor_laser_cutoffs', 'consultation_prices',
    'price_categories', 'price_items', 'laser_price_map', 'kb_articles'
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
-- doctor_updates: everyone reads; admin or the owning branch writes
-- ---------------------------------------------------------------------
create policy doctor_updates_read on public.doctor_updates
  for select to authenticated using (public.current_app_role() is not null);

create policy doctor_updates_write on public.doctor_updates
  for all to authenticated
  using (
    public.current_app_role() = 'admin'
    or (public.current_app_role() = 'branch' and branch_id = public.current_branch_id())
  )
  with check (
    public.current_app_role() = 'admin'
    or (public.current_app_role() = 'branch'
        and branch_id = public.current_branch_id()
        and created_by = auth.uid())
  );
-- Note: branch_id is forced from doctor_id by trigger, so a branch cannot
-- write an update for another branch's doctor (the WITH CHECK fails).

-- ---------------------------------------------------------------------
-- profiles: every active user can read names (to show "who did what");
-- only admin writes. Account creation itself uses the service role
-- (server-side Next.js action) because it touches auth.users.
-- ---------------------------------------------------------------------
create policy profiles_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_app_role() is not null);

create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- ---------------------------------------------------------------------
-- tickets / ticket_events: call center sees all; branch sees its own
-- ---------------------------------------------------------------------
create policy tickets_read on public.tickets
  for select to authenticated
  using (
    public.is_call_center()
    or (public.current_app_role() = 'branch' and branch_id = public.current_branch_id())
  );

create policy ticket_events_read on public.ticket_events
  for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));  -- inherits tickets RLS

-- ---------------------------------------------------------------------
-- notifications: own rows only; user can mark as read
-- ---------------------------------------------------------------------
create policy notifications_read on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------
revoke insert, update, delete on public.tickets, public.ticket_events from authenticated, anon;
revoke insert, delete on public.notifications from authenticated, anon;
revoke update on public.notifications from authenticated;
grant  update (read_at) on public.notifications to authenticated;

-- Internal helpers must not be callable from the client.
revoke execute on function public._notify_role(public.app_role, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.mark_sla_breaches() from public, anon, authenticated;

-- Anonymous users get nothing.
revoke execute on function public.create_ticket(uuid, text, text, text, public.client_gender, text[], date, time, time, text) from public, anon;
revoke execute on function public.branch_respond(uuid, public.branch_response, text, text, date, time, uuid) from public, anon;
revoke execute on function public.acknowledge_notice(uuid, text) from public, anon;
revoke execute on function public.close_ticket(uuid, public.ticket_outcome, text) from public, anon;
revoke execute on function public.cancel_ticket(uuid, text) from public, anon;
revoke execute on function public.resolve_ticket_kind(uuid, date) from public, anon;

grant execute on function public.create_ticket(uuid, text, text, text, public.client_gender, text[], date, time, time, text) to authenticated;
grant execute on function public.branch_respond(uuid, public.branch_response, text, text, date, time, uuid) to authenticated;
grant execute on function public.acknowledge_notice(uuid, text) to authenticated;
grant execute on function public.close_ticket(uuid, public.ticket_outcome, text) to authenticated;
grant execute on function public.cancel_ticket(uuid, text) to authenticated;
grant execute on function public.resolve_ticket_kind(uuid, date) to authenticated;
