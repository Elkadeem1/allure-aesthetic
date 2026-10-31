// Loads the full per-branch dashboard data (schedules, updates, prices, rooms).
// Lives in lib/ (not the page) so both /dashboard and server actions can import
// it — Next.js rejects non-page exports from a page file at build time.

import { createClient } from "@/lib/supabase/server"
import { cairoToday } from "@/lib/time"
import { categoryStartsFrom } from "@/lib/engine/pricing"
import type { Gender } from "@/lib/engine"
import type { LaserAreaPrice, PriceBook, PriceCategory, PricedItem } from "@/lib/engine/pricing"
import type { BranchData, PriceItemData } from "@/components/dashboard/types"

const toNum = (v: number | string | null): number | null =>
  v === null || v === undefined ? null : Number(v)

export async function loadBranches(): Promise<BranchData[]> {
  const supabase = await createClient()
  const todayStr = cairoToday()

  const [
    branchesRes,
    doctorsRes,
    schedulesRes,
    roomsRes,
    doctorRoomsRes,
    updatesRes,
    branchServicesRes,
    servicesRes,
    categoriesRes,
    itemsRes,
    branchPricesRes,
    itemDoctorsRes,
    priceMapRes,
    kbRes,
  ] = await Promise.all([
    supabase
      .from("branches")
      .select("id, code, name_ar, address, payment_methods, has_tickets, logo_url, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase
      .from("doctors")
      .select("id, branch_id, display_name, specialty, notes, accepts_men, laser_men_allowed, men_laser_area_codes, rejects_small_areas_only, no_overlap, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase.from("doctor_schedules").select("id, doctor_id, weekday, start_time, end_time, kind"),
    supabase.from("rooms").select("id, branch_id, code, title, sort").order("sort"),
    supabase.from("doctor_rooms").select("doctor_id, weekday, room_id"),
    supabase
      .from("doctor_updates")
      .select("id, branch_id, doctor_id, type, date_from, date_to, at_time, weekdays, note, segments")
      .gte("date_to", todayStr)
      .order("date_from"),
    supabase.from("branch_services").select("branch_id, service_id"),
    supabase
      .from("services")
      .select("id, code, name_ar, kb_slug, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase
      .from("price_categories")
      .select("id, code, name_ar, name_en, starts_from, kb_slug, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase
      .from("price_items")
      .select("id, code, category_id, group_name, variant, unit, full_name, item_type, price_text, notes, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase.from("price_item_branch_prices").select("item_id, branch_id, price"),
    supabase.from("price_item_doctors").select("item_id, doctor_id"),
    supabase
      .from("laser_area_price_map")
      .select("area_codes, gender, single_item_code, package3_item_code, sort")
      .order("sort"),
    supabase.from("kb_articles").select("slug, title, body"),
  ])

  const branches = branchesRes.data ?? []
  const doctors = doctorsRes.data ?? []
  const schedules = schedulesRes.data ?? []
  const rooms = roomsRes.data ?? []
  const doctorRooms = doctorRoomsRes.data ?? []
  const updates = updatesRes.data ?? []
  const branchServices = branchServicesRes.data ?? []
  const services = servicesRes.data ?? []
  const categories = categoriesRes.data ?? []
  const items = itemsRes.data ?? []
  const branchPrices = branchPricesRes.data ?? []
  const itemDoctors = itemDoctorsRes.data ?? []
  const laserMap = priceMapRes.data ?? []
  const kbArticles = kbRes.data ?? []

  // ---- shared price lookups ----
  const categoryCodeById = new Map(categories.map((c) => [c.id, c.code]))
  const notesByCode = new Map(items.map((it) => [it.code, it.notes as string | null]))
  const priceCategories: PriceCategory[] = categories.map((c) => ({
    code: c.code,
    nameAr: c.name_ar,
    nameEn: c.name_en,
    startsFrom: toNum(c.starts_from),
  }))
  const categoryMeta = new Map(
    categories.map((c) => [c.code, { name: c.name_ar, kbSlug: c.kb_slug, sort: c.sort }])
  )

  const priceByItemBranch = new Map<string, Map<string, number>>()
  for (const row of branchPrices) {
    const p = toNum(row.price)
    if (p === null) continue
    let m = priceByItemBranch.get(row.item_id)
    if (!m) priceByItemBranch.set(row.item_id, (m = new Map()))
    m.set(row.branch_id, p)
  }
  const doctorsByItem = new Map<string, string[]>()
  for (const row of itemDoctors) {
    const list = doctorsByItem.get(row.item_id) ?? []
    list.push(row.doctor_id)
    doctorsByItem.set(row.item_id, list)
  }

  function pricedItemsFor(branchId: string): PricedItem[] {
    const out: PricedItem[] = []
    for (const it of items) {
      const price = priceByItemBranch.get(it.id)?.get(branchId) ?? null
      if (price === null && it.price_text === null) continue
      out.push({
        code: it.code,
        categoryCode: categoryCodeById.get(it.category_id) ?? "",
        itemType: it.item_type === "addon" ? "addon" : "service",
        fullName: it.full_name,
        groupName: it.group_name,
        variant: it.variant,
        unit: it.unit,
        price,
        priceText: it.price_text,
        doctorIds: doctorsByItem.get(it.id) ?? null,
      })
    }
    return out
  }

  const roomTitleById = new Map(rooms.map((r) => [r.id, r.title]))

  return branches.map((branch) => {
    const branchItems = pricedItemsFor(branch.id)
    const book: PriceBook = { categories: priceCategories, items: branchItems, laserMap: [] as LaserAreaPrice[] }

    const branchDoctorRows = doctors.filter((d) => d.branch_id === branch.id)

    const branchUpdates = updates
      .filter((u) => u.branch_id === branch.id)
      .map((u) => ({
        id: u.id,
        doctorId: u.doctor_id,
        type: u.type,
        dateFrom: u.date_from,
        dateTo: u.date_to,
        atTime: u.at_time,
        weekdays: u.weekdays ?? [],
        note: u.note,
        segments: (u.segments as Array<{ start: string; end: string; kind?: string }>) ?? [],
      }))

    const serviceIds = new Set(
      branchServices.filter((bs) => bs.branch_id === branch.id).map((bs) => bs.service_id)
    )
    const branchServiceList = services
      .filter((s) => serviceIds.has(s.id))
      .map((s) => ({ id: s.id, code: s.code, nameAr: s.name_ar, kbSlug: s.kb_slug }))

    // Price catalogue, grouped by category (only categories with items here).
    const byCategory = new Map<string, PriceItemData[]>()
    for (const it of branchItems) {
      const row: PriceItemData = {
        code: it.code,
        name: it.fullName,
        price: it.price,
        priceText: it.priceText,
        unit: it.unit,
        itemType: it.itemType,
        groupName: it.groupName,
        variant: it.variant,
        notes: notesByCode.get(it.code) ?? null,
      }
      const list = byCategory.get(it.categoryCode) ?? []
      list.push(row)
      byCategory.set(it.categoryCode, list)
    }

    // Laser tables (LSR): women/men area rows (single + 3-session + bundles)
    // from the laser_area_price_map, plus pulse / prepaid / addons as extras.
    const itemByCode = new Map(branchItems.map((i) => [i.code, i]))
    const usedInMap = new Set<string>()
    for (const m of laserMap) {
      usedInMap.add(m.single_item_code)
      if (m.package3_item_code) usedInMap.add(m.package3_item_code)
    }
    const laserRow = (gender: string) =>
      laserMap
        .filter((m) => m.gender === gender)
        .map((m) => {
          const single = itemByCode.get(m.single_item_code)
          if (!single) return null
          const pkg = m.package3_item_code ? itemByCode.get(m.package3_item_code) : null
          return {
            label: single.fullName,
            single: single.price,
            package3: pkg?.price ?? null,
            isBundle: m.area_codes.length > 1,
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
    const lsrItems = byCategory.get("LSR") ?? []
    const laserExtras = lsrItems
      .filter((it) => !usedInMap.has(it.code))
      .map((it) => ({
        code: it.code,
        label: it.name,
        unit: it.unit,
        price: it.price,
        priceText: it.priceText,
        isAddon: it.itemType === "addon",
      }))
    const women = laserRow("female")
    const men = laserRow("male")
    const laserTable =
      women.length || men.length || laserExtras.length ? { women, men, extras: laserExtras } : null
    const catalogue = [...byCategory.entries()]
      .map(([code, catItems]) => {
        const meta = categoryMeta.get(code)
        return {
          code,
          name: meta?.name ?? code,
          startsFrom: categoryStartsFrom(book, code),
          kbSlug: meta?.kbSlug ?? null,
          sort: meta?.sort ?? 999,
          items: catItems,
        }
      })
      .sort((a, b) => a.sort - b.sort)

    // Consultation card = CON items offered here (incl. doctor-specific + Re Cons text).
    const consultations = branchItems
      .filter((it) => it.categoryCode === "CON")
      .map((it) => ({ code: it.code, label: it.fullName, price: it.price, priceText: it.priceText }))

    const pulseOf = (g: Gender) =>
      branchItems.find((it) => it.code === (g === "male" ? "LSR-40" : "LSR-21"))?.price ?? null

    return {
      id: branch.id,
      code: branch.code,
      nameAr: branch.name_ar,
      address: branch.address,
      paymentMethods: branch.payment_methods,
      hasTickets: branch.has_tickets,
      logoUrl: branch.logo_url,
      rooms: rooms
        .filter((r) => r.branch_id === branch.id)
        .map((r) => ({ id: r.id, code: r.code, title: r.title, sort: r.sort })),
      doctors: branchDoctorRows.map((d) => ({
        id: d.id,
        displayName: d.display_name,
        notes: d.notes,
        specialty: d.specialty,
        sort: d.sort,
        acceptsMen: d.accepts_men,
        laserMenAllowed: d.laser_men_allowed,
        menLaserAreaCodes: d.men_laser_area_codes,
        rejectsSmallAreasOnly: d.rejects_small_areas_only,
        noOverlap: d.no_overlap,
        schedules: schedules
          .filter((s) => s.doctor_id === d.id)
          .map((s) => ({
            id: s.id,
            weekday: s.weekday,
            startTime: s.start_time,
            endTime: s.end_time,
            kind: s.kind,
          })),
        rooms: doctorRooms
          .filter((r) => r.doctor_id === d.id && roomTitleById.has(r.room_id))
          .map((r) => ({ weekday: r.weekday, roomId: r.room_id, roomTitle: roomTitleById.get(r.room_id) as string })),
      })),
      doctorUpdates: branchUpdates,
      consultations,
      pulseFemale: pulseOf("female"),
      pulseMale: pulseOf("male"),
      services: branchServiceList,
      priceCategories: catalogue,
      laserTable,
      kbArticles: kbArticles.map((a) => ({ slug: a.slug, title: a.title, body: a.body })),
    }
  })
}
