-- =====================================================================
-- Phase 5c test: admin_apply_price_import() — admin-only, UPSERTs items by
-- code, replaces branch prices, deactivates missing non-Innova items, leaves
-- Innova (INV-xxx) untouched, and records a history row. Runs after 10_*.
-- =====================================================================
\set ON_ERROR_STOP 1

-- ---------- admin applies a tiny one-item file ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

do $$
declare
  inv_active_before int;
  active_nonin int;
  new_price numeric;
  imports_before int;
  imports_after int;
begin
  if not exists (select 1 from public.price_items where code = 'FIL-01') then
    raise exception 'seed missing FIL-01 to test with';
  end if;
  select count(*) into inv_active_before from public.price_items where is_active and code like 'INV-%';
  select count(*) into imports_before from public.price_imports;

  perform public.admin_apply_price_import(
    '[{"code":"FIL","name_ar":"فيلر","name_en":"Filler","sort":0,"kb_slug":"def:filler","starts_from":null}]'::jsonb,
    '[{"code":"FIL-01","category_code":"FIL","group_name":"G","variant":"V","unit":"U","full_name":"Updated FIL-01","item_type":"service","availability_text":null,"notes":null,"price_text":null,"sort":0}]'::jsonb,
    '[{"code":"FIL-01","branch":"newcairo","price":1234}]'::jsonb,
    'test.xlsx',
    '{"newItems":0,"changedItems":1,"deactivatedItems":0}'::jsonb);

  -- branch price updated
  select price into new_price
    from public.price_item_branch_prices bp
    join public.price_items pi on pi.id = bp.item_id
    join public.branches b on b.id = bp.branch_id
   where pi.code = 'FIL-01' and b.code = 'newcairo';
  if new_price is distinct from 1234 then raise exception 'price not applied, got %', new_price; end if;

  -- only the one non-Innova item stays active; the rest were deactivated
  select count(*) into active_nonin from public.price_items where is_active and code not like 'INV-%';
  if active_nonin <> 1 then raise exception 'expected 1 active non-innova item, got %', active_nonin; end if;

  -- Innova items untouched
  if (select count(*) from public.price_items where is_active and code like 'INV-%') <> inv_active_before then
    raise exception 'Innova items were touched by the Excel upload';
  end if;

  -- history row recorded, attributed to the admin
  select count(*) into imports_after from public.price_imports;
  if imports_after <> imports_before + 1 then raise exception 'no price_imports history row'; end if;
  if not exists (select 1 from public.price_imports
                 where file_name = 'test.xlsx'
                   and imported_by = '00000000-0000-0000-0000-00000000000a') then
    raise exception 'history row not attributed to the admin';
  end if;
end $$;

reset role;

-- ---------- non-admin is refused ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false); -- agent
set role authenticated;

do $$
declare refused boolean := false;
begin
  begin
    perform public.admin_apply_price_import('[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'x', '{}'::jsonb);
  exception when others then refused := true;
  end;
  if not refused then raise exception 'non-admin must not apply price imports'; end if;
end $$;

reset role;

\echo '✓ 22_prices_import_test passed'
