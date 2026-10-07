import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PricingAdmin } from "@/components/admin/pricing-admin"

export default async function AdminPricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: priceLists },
    { data: categories },
    { data: items },
    { data: laserPriceMap },
    { data: branches },
    { data: consultationPrices },
    { data: doctors },
  ] = await Promise.all([
    supabase.from("price_lists").select("*"),
    supabase.from("price_categories").select("*").order("sort"),
    supabase.from("price_items").select("*").order("sort"),
    supabase.from("laser_price_map").select("*"),
    supabase.from("branches").select("id, name_ar, price_list_id").eq("is_active", true).order("sort"),
    supabase.from("consultation_prices").select("*"),
    supabase.from("doctors").select("id, display_name, branch_id").eq("is_active", true).order("sort"),
  ])

  return (
    <PricingAdmin
      priceLists={priceLists ?? []}
      categories={categories ?? []}
      items={items ?? []}
      laserPriceMap={laserPriceMap ?? []}
      branches={(branches ?? []).map((b) => ({
        id: b.id,
        nameAr: b.name_ar,
        priceListId: b.price_list_id,
      }))}
      consultationPrices={consultationPrices ?? []}
      doctors={(doctors ?? []).map((d) => ({
        id: d.id,
        displayName: d.display_name,
        branchId: d.branch_id,
      }))}
    />
  )
}
