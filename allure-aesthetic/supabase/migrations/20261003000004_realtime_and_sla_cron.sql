-- =====================================================================
-- Allure Aesthetic — Phase 1 / Migration 4: Realtime + SLA cron
-- =====================================================================

-- Realtime: postgres_changes respect RLS, so a branch only receives
-- its own tickets and each user only their own notifications.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.tickets, public.ticket_events, public.notifications, public.doctor_updates;
  end if;
end $$;

-- SLA check every minute. The UI also shows a live countdown, so the
-- branch sees the timer even between cron runs.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;  -- Supabase convention
    perform cron.schedule('allure-sla-check', '* * * * *', 'select public.mark_sla_breaches()');
  else
    raise notice 'pg_cron not available — schedule public.mark_sla_breaches() another way';
  end if;
end $$;
