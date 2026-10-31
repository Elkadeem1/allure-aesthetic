-- Step 5 — post-apply verification. Run against the LIVE DB after the sync.
-- Every row should match its "expected" column.
select 'branches total'                 as check, count(*)::text as value, '7'      as expected from public.branches
union all
select 'innova has_tickets',  coalesce((select has_tickets::text from public.branches where code = 'innova'), 'MISSING'), 'true'
union all
select 'active doctors',      (select count(*)::text from public.doctors where is_active), '46'
union all
select 'rooms',               (select count(*)::text from public.rooms), '2'
union all
select 'price_items (active)',(select count(*)::text from public.price_items where is_active), '337'
union all
select 'price_item_branch_prices', (select count(*)::text from public.price_item_branch_prices), '1631'
union all
select 'DPN starts_from',     coalesce((select starts_from::text from public.price_categories where code = 'DPN'), 'MISSING'), '750'
union all
select 'active branch profiles (codes)',
       coalesce((select string_agg(b.code, ',') from public.profiles p join public.branches b on b.id = p.branch_id
                 where p.role = 'branch' and p.is_active), '(none)'),
       'innova or (none) — never a non-Innova branch'
union all
select 'open tickets on non-Innova branches',
       (select count(*)::text from public.tickets t join public.branches b on b.id = t.branch_id
        where not b.has_tickets and t.status in ('pending','answered')), '0';
