import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  PricesAdmin,
  type PriceCat,
  type PriceItemRow,
  type PriceBranch,
  type ImportRow,
} from "@/components/admin/prices-admin"

export default async function AdminPricesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [catsRes, itemsRes, pricesRes, branchesRes, importsRes] = await Promise.all([
    supabase.from("price_categories").select("id, code, name_ar, starts_from, sort").order("sort"),
    supabase
      .from("price_items")
      .select("id, code, category_id, full_name, group_name, variant, unit, notes, item_type, is_active, price_text, sort")
      .order("sort"),
    supabase.from("price_item_branch_prices").select("item_id, branch_id, price"),
    supabase.from("branches").select("id, code, name_ar, sort").eq("is_active", true).order("sort"),
    supabase.from("price_imports").select("id, file_name, counts, created_at, imported_by").order("created_at", { ascending: false }).limit(10),
  ])

  const pricesByItem = new Map<string, Record<string, number>>()
  for (const p of pricesRes.data ?? []) {
    const m = pricesByItem.get(p.item_id) ?? {}
    m[p.branch_id] = p.price
    pricesByItem.set(p.item_id, m)
  }

  const categories: PriceCat[] = (catsRes.data ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    nameAr: c.name_ar,
    startsFrom: c.starts_from,
  }))

  const items: PriceItemRow[] = (itemsRes.data ?? []).map((i) => ({
    id: i.id,
    code: i.code,
    categoryId: i.category_id,
    fullName: i.full_name,
    groupName: i.group_name,
    variant: i.variant,
    unit: i.unit,
    notes: i.notes,
    itemType: (i.item_type === "addon" ? "addon" : "service") as "service" | "addon",
    isActive: i.is_active,
    priceText: i.price_text,
    prices: pricesByItem.get(i.id) ?? {},
  }))

  const branches: PriceBranch[] = (branchesRes.data ?? []).map((b) => ({
    id: b.id,
    code: b.code,
    nameAr: b.name_ar,
  }))

  // "who" for the import history
  const byIds = [...new Set((importsRes.data ?? []).map((r) => r.imported_by).filter(Boolean))] as string[]
  const whoById = new Map<string, string>()
  if (byIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", byIds)
    for (const p of profs ?? []) whoById.set(p.id, p.full_name)
  }

  const imports: ImportRow[] = (importsRes.data ?? []).map((r) => {
    const counts = (r.counts ?? {}) as { newItems?: number; changedItems?: number; deactivatedItems?: number }
    return {
      id: r.id,
      fileName: r.file_name,
      createdAt: r.created_at,
      by: r.imported_by ? whoById.get(r.imported_by) ?? null : null,
      newItems: counts.newItems ?? 0,
      changedItems: counts.changedItems ?? 0,
      deactivatedItems: counts.deactivatedItems ?? 0,
    }
  })

  return <PricesAdmin categories={categories} items={items} branches={branches} imports={imports} />
}
