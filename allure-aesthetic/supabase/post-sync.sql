-- =====================================================================
-- Post-sync operational data (NOT part of the schema; run once after the
-- HTML sync + price import on the live DB). Idempotent; admin-removable.
-- =====================================================================

-- Dr Nourhan El Abd (Kafr El-Sheikh): stopped taking new bookings from
-- 2026-10-09 until further notice (HTML tempNote; not auto-imported).
-- Admin can delete this row to re-open her bookings.
insert into public.doctor_updates (doctor_id, type, date_from, date_to, note)
select d.id, 'stop', date '2026-10-09', date '2027-10-09',
       'متوقفة عن استقبال حجوزات جديدة لحد إشعار جديد'
from public.doctors d
join public.branches b on b.id = d.branch_id
where b.code = 'kafrelsheikh' and d.code = 'nourhanelabd'
  and not exists (
    select 1 from public.doctor_updates u
    where u.doctor_id = d.id and u.type::text = 'stop'
      and u.date_from = date '2026-10-09' and u.date_to = date '2027-10-09'
  );
