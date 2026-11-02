-- =====================================================================
-- Migration 8: admin price-list upload (Phase 5c)
--   * price_imports — small audit/history table (who, when, file, counts).
--   * admin_apply_price_import() — applies a parsed price-list upload in ONE
--     transaction: UPSERT categories + items by code, replace per-branch
--     prices for the uploaded items, deactivate non-Innova items missing
--     from the file, and record a history row. Admin-only; Innova (INV-xxx)
--     items are never touched by the Excel upload.
-- =====================================================================

create table if not exists public.price_imports (
  id          uuid primary key default gen_random_uuid(),
  file_name   text,
  imported_by uuid references auth.users(id) on delete set null,
  counts      jsonb not null default '{}'::jsonb,   -- {new, changed, deactivated}
  created_at  timestamptz not null default now()
);

alter table public.price_imports enable row level security;
drop policy if exists price_imports_admin_read on public.price_imports;
create policy price_imports_admin_read on public.price_imports
  for select to authenticated using (public.current_app_role() = 'admin');
-- No client insert policy: only the SECURITY DEFINER RPC writes history rows.

create or replace function public.admin_apply_price_import(
  p_categories    jsonb,
  p_items         jsonb,
  p_branch_prices jsonb,
  p_file_name     text,
  p_counts        jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  c jsonb; it jsonb; bp jsonb;
  v_cat_id  uuid;
  v_item_id uuid;
  v_codes   text[];
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  -- 1) categories (upsert by code; reactivate)
  for c in select * from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)) loop
    insert into public.price_categories (code, name_ar, name_en, sort, kb_slug, starts_from, is_active)
    values (
      c->>'code', c->>'name_ar', c->>'name_en', coalesce((c->>'sort')::int, 0),
      c->>'kb_slug', nullif(c->>'starts_from', '')::numeric, true)
    on conflict (code) do update set
      name_ar = excluded.name_ar, name_en = excluded.name_en, sort = excluded.sort,
      kb_slug = excluded.kb_slug, starts_from = excluded.starts_from, is_active = true;
  end loop;

  -- 2) items (upsert by code; reactivate)
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select id into v_cat_id from public.price_categories where code = it->>'category_code';
    if v_cat_id is null then
      raise exception 'category_not_found' using errcode = '22023', detail = coalesce(it->>'category_code', '');
    end if;
    insert into public.price_items (
      code, category_id, group_name, variant, unit, full_name, item_type,
      availability_text, notes, price_text, sort, is_active)
    values (
      it->>'code', v_cat_id, it->>'group_name', it->>'variant', it->>'unit', it->>'full_name',
      coalesce(it->>'item_type', 'service'), it->>'availability_text', it->>'notes',
      it->>'price_text', coalesce((it->>'sort')::int, 0), true)
    on conflict (code) do update set
      category_id = excluded.category_id, group_name = excluded.group_name, variant = excluded.variant,
      unit = excluded.unit, full_name = excluded.full_name, item_type = excluded.item_type,
      availability_text = excluded.availability_text, notes = excluded.notes,
      price_text = excluded.price_text, sort = excluded.sort, is_active = true;
  end loop;

  -- 3) per-branch prices: replace for the uploaded items only
  select array_agg(x->>'code') into v_codes
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x;
  if v_codes is not null then
    delete from public.price_item_branch_prices
     where item_id in (select id from public.price_items where code = any (v_codes));
  end if;
  for bp in select * from jsonb_array_elements(coalesce(p_branch_prices, '[]'::jsonb)) loop
    select id into v_item_id from public.price_items where code = bp->>'code';
    if v_item_id is not null then
      insert into public.price_item_branch_prices (item_id, branch_id, price)
      values (
        v_item_id,
        (select id from public.branches where code = bp->>'branch'),
        (bp->>'price')::numeric)
      on conflict (item_id, branch_id) do update set price = excluded.price;
    end if;
  end loop;

  -- 4) deactivate non-Innova items missing from the file (never delete)
  update public.price_items set is_active = false
   where code not like 'INV-%'
     and (v_codes is null or code <> all (v_codes));

  -- 5) history
  insert into public.price_imports (file_name, imported_by, counts)
  values (p_file_name, auth.uid(), coalesce(p_counts, '{}'::jsonb));
end $$;

revoke execute on function public.admin_apply_price_import(jsonb, jsonb, jsonb, text, jsonb) from public, anon;
grant  execute on function public.admin_apply_price_import(jsonb, jsonb, jsonb, text, jsonb) to authenticated;
