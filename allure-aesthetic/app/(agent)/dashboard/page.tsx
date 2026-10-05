import { createClient } from "@/lib/supabase/server"
import { cairoToday } from "@/lib/time"
import { BranchTabs } from "@/components/dashboard/branch-tabs"
import type { BranchData } from "@/components/dashboard/types"

async function fetchDashboardData(): Promise<BranchData[]> {
  const supabase = await createClient()
  const todayStr = cairoToday()

  const [
    branchesRes,
    policiesRes,
    doctorsRes,
    schedulesRes,
    updatesRes,
    consultPricesRes,
    branchServicesRes,
    servicesRes,
    categoriesRes,
    itemsRes,
    kbRes,
  ] = await Promise.all([
    supabase
      .from("branches")
      .select("id, code, name_ar, address, payment_methods, price_list_id, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase
      .from("branch_policies")
      .select("branch_id, booking_rules"),
    supabase
      .from("doctors")
      .select("id, branch_id, display_name, notes, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase
      .from("doctor_schedules")
      .select("id, doctor_id, weekday, start_time, end_time, kind"),
    supabase
      .from("doctor_updates")
      .select("id, branch_id, doctor_id, type, date_from, date_to, note, segments")
      .gte("date_to", todayStr)
      .order("date_from"),
    supabase
      .from("consultation_prices")
      .select("id, branch_id, doctor_id, kind, price"),
    supabase
      .from("branch_services")
      .select("branch_id, service_id"),
    supabase
      .from("services")
      .select("id, code, name_ar, kb_slug, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase
      .from("price_categories")
      .select("id, price_list_id, name, info_note, kb_slug, sort")
      .order("sort"),
    supabase
      .from("price_items")
      .select("id, category_id, name, price, price_text, sort")
      .order("sort"),
    supabase
      .from("kb_articles")
      .select("slug, title, body"),
  ])

  const branches = branchesRes.data ?? []
  const policies = policiesRes.data ?? []
  const doctors = doctorsRes.data ?? []
  const schedules = schedulesRes.data ?? []
  const updates = updatesRes.data ?? []
  const consultPrices = consultPricesRes.data ?? []
  const branchServices = branchServicesRes.data ?? []
  const services = servicesRes.data ?? []
  const categories = categoriesRes.data ?? []
  const items = itemsRes.data ?? []
  const kbArticles = kbRes.data ?? []

  // Build doctor name lookup for consultation price overrides
  const doctorNameMap = new Map(doctors.map((d) => [d.id, d.display_name]))

  return branches.map((branch) => {
    const policy = policies.find((p) => p.branch_id === branch.id)
    const branchDoctors = doctors.filter((d) => d.branch_id === branch.id)

    const branchUpdates = updates
      .filter((u) => u.branch_id === branch.id)
      .map((u) => ({
        id: u.id,
        doctorId: u.doctor_id,
        type: u.type,
        dateFrom: u.date_from,
        dateTo: u.date_to,
        note: u.note,
        segments: u.segments as Array<{ start: string; end: string; kind?: string }>,
      }))

    const branchConsultPrices = consultPrices
      .filter((p) => p.branch_id === branch.id)
      .map((p) => ({
        kind: p.kind,
        price: Number(p.price),
        doctorId: p.doctor_id,
        doctorName: p.doctor_id ? (doctorNameMap.get(p.doctor_id) ?? undefined) : undefined,
      }))

    const serviceIds = new Set(
      branchServices.filter((bs) => bs.branch_id === branch.id).map((bs) => bs.service_id)
    )
    const branchServiceList = services
      .filter((s) => serviceIds.has(s.id))
      .map((s) => ({
        id: s.id,
        code: s.code,
        nameAr: s.name_ar,
        kbSlug: s.kb_slug,
      }))

    const priceListId = branch.price_list_id
    const branchCategories = priceListId
      ? categories
          .filter((c) => c.price_list_id === priceListId)
          .map((c) => ({
            id: c.id,
            name: c.name,
            infoNote: c.info_note,
            kbSlug: c.kb_slug,
            sort: c.sort,
            items: items
              .filter((i) => i.category_id === c.id)
              .map((i) => ({
                id: i.id,
                name: i.name,
                price: i.price !== null ? Number(i.price) : null,
                priceText: i.price_text,
                sort: i.sort,
              })),
          }))
      : []

    return {
      id: branch.id,
      nameAr: branch.name_ar,
      address: branch.address,
      paymentMethods: branch.payment_methods,
      bookingRules: policy?.booking_rules ?? [],
      doctors: branchDoctors.map((d) => ({
        id: d.id,
        displayName: d.display_name,
        notes: d.notes,
        sort: d.sort,
        schedules: schedules
          .filter((s) => s.doctor_id === d.id)
          .map((s) => ({
            id: s.id,
            weekday: s.weekday,
            startTime: s.start_time,
            endTime: s.end_time,
            kind: s.kind,
          })),
      })),
      doctorUpdates: branchUpdates,
      consultationPrices: branchConsultPrices,
      services: branchServiceList,
      priceCategories: branchCategories,
      kbArticles: kbArticles.map((a) => ({
        slug: a.slug,
        title: a.title,
        body: a.body,
      })),
    }
  })
}

export default async function DashboardPage() {
  const branches = await fetchDashboardData()

  if (branches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-semibold text-muted-foreground">لا توجد فروع نشطة</p>
      </div>
    )
  }

  return <BranchTabs branches={branches} />
}
