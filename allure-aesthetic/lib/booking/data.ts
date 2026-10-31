// =====================================================================
// Server-side loader that shapes every table the booking engine needs into
// plain, serialisable objects. Used by the wizard page (to hydrate the client
// engine) and by the send action (to re-load fresh data and re-validate on the
// server). No rule logic lives here — only fetching + camelCase mapping.
//
// Price model: migration 6's per-branch tables (price_categories /
// price_items / price_item_branch_prices / price_item_doctors /
// laser_area_price_map), resolved into one PriceBook per branch.
// =====================================================================

import { createClient } from "@/lib/supabase/server"
import { cairoToday } from "@/lib/time"
import type {
  BranchLaserCutoff,
  Doctor,
  DoctorLaserCutoff,
  DoctorRoom,
  DoctorSchedule,
  DoctorUpdate,
  Gender,
  LaserConfig,
  Service,
} from "@/lib/engine"
import type { LaserAreaPrice, PriceBook, PriceCategory, PricedItem } from "@/lib/engine/pricing"

export type WizardDoctor = {
  doctor: Doctor
  schedules: DoctorSchedule[]
  laserCutoffs: DoctorLaserCutoff[]
  rooms: DoctorRoom[]
}

export type WizardBranch = {
  id: string
  code: string
  nameAr: string
  hasTickets: boolean
  logoUrl: string | null
  branchLaserCutoffs: BranchLaserCutoff[]
  services: Service[]
  serviceNames: Record<string, string> // code -> Arabic name
  doctors: WizardDoctor[]
  updates: DoctorUpdate[] // branch-wide + per-doctor, future-dated
  priceBook: PriceBook
}

export type BookingData = {
  todayStr: string
  laserConfig: LaserConfig
  branches: WizardBranch[]
}

const toNum = (v: number | string | null): number | null =>
  v === null || v === undefined ? null : Number(v)

export async function loadBookingData(): Promise<BookingData> {
  const supabase = await createClient()
  const todayStr = cairoToday()

  const [
    branchesRes,
    doctorsRes,
    schedulesRes,
    docCutoffsRes,
    branchCutoffsRes,
    roomsRes,
    doctorRoomsRes,
    updatesRes,
    branchServicesRes,
    servicesRes,
    areasRes,
    conflictsRes,
    combosRes,
    categoriesRes,
    itemsRes,
    branchPricesRes,
    itemDoctorsRes,
    priceMapRes,
  ] = await Promise.all([
    supabase.from("branches").select("id, code, name_ar, has_tickets, logo_url, sort").eq("is_active", true).order("sort"),
    supabase
      .from("doctors")
      .select(
        "id, branch_id, code, display_name, person_key, default_booking_status, always_open, accepts_men, laser_men_allowed, men_laser_area_codes, rejects_small_areas_only, no_overlap, specialty, notes, sort"
      )
      .eq("is_active", true)
      .order("sort"),
    supabase.from("doctor_schedules").select("doctor_id, weekday, start_time, end_time, kind"),
    supabase.from("doctor_laser_cutoffs").select("doctor_id, weekday, cutoff"),
    supabase.from("branch_laser_cutoffs").select("branch_id, weekday, shift_starts_before, cutoff"),
    supabase.from("rooms").select("id, branch_id, title"),
    supabase.from("doctor_rooms").select("doctor_id, weekday, room_id"),
    supabase
      .from("doctor_updates")
      .select("id, branch_id, doctor_id, type, date_from, date_to, at_time, weekdays, note, segments, created_at")
      .gte("date_to", todayStr)
      .order("created_at"),
    supabase.from("branch_services").select("branch_id, service_id"),
    supabase
      .from("services")
      .select("id, code, name_ar, default_duration_min, uses_laser_areas, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase
      .from("laser_areas")
      .select("code, gender, name_en, hint_ar, duration_min, is_small, is_full_body, requires_companion, sort")
      .order("sort"),
    supabase.from("laser_area_conflicts").select("area_code, conflicts_with"),
    supabase
      .from("laser_area_combos")
      .select("label, required_codes, any_of_codes, duration_adjust_min, sort")
      .order("sort"),
    supabase.from("price_categories").select("id, code, name_ar, name_en, starts_from, sort").eq("is_active", true).order("sort"),
    supabase
      .from("price_items")
      .select("id, code, category_id, group_name, variant, unit, full_name, item_type, price_text, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase.from("price_item_branch_prices").select("item_id, branch_id, price"),
    supabase.from("price_item_doctors").select("item_id, doctor_id"),
    supabase.from("laser_area_price_map").select("area_codes, gender, single_item_code, package3_item_code, sort").order("sort"),
  ])

  const branches = branchesRes.data ?? []
  const doctors = doctorsRes.data ?? []
  const schedules = schedulesRes.data ?? []
  const docCutoffs = docCutoffsRes.data ?? []
  const branchCutoffs = branchCutoffsRes.data ?? []
  const rooms = roomsRes.data ?? []
  const doctorRooms = doctorRoomsRes.data ?? []
  const updates = updatesRes.data ?? []
  const branchServices = branchServicesRes.data ?? []
  const services = servicesRes.data ?? []
  const categories = categoriesRes.data ?? []
  const items = itemsRes.data ?? []
  const branchPrices = branchPricesRes.data ?? []
  const itemDoctors = itemDoctorsRes.data ?? []

  const laserConfig: LaserConfig = {
    areas: (areasRes.data ?? []).map((a) => ({
      code: a.code,
      gender: a.gender as Gender,
      nameEn: a.name_en,
      hintAr: a.hint_ar,
      durationMin: a.duration_min,
      isSmall: a.is_small,
      isFullBody: a.is_full_body,
      requiresCompanion: a.requires_companion,
    })),
    conflicts: (conflictsRes.data ?? []).map((c) => ({
      areaCode: c.area_code,
      conflictsWith: c.conflicts_with,
    })),
    combos: (combosRes.data ?? []).map((c) => ({
      label: c.label,
      requiredCodes: c.required_codes,
      anyOfCodes: c.any_of_codes,
      durationAdjustMin: c.duration_adjust_min,
    })),
  }

  // ---- price model: shared lookups built once ----
  const categoryCodeById = new Map(categories.map((c) => [c.id, c.code]))
  const priceCategories: PriceCategory[] = categories.map((c) => ({
    code: c.code,
    nameAr: c.name_ar,
    nameEn: c.name_en,
    startsFrom: toNum(c.starts_from),
  }))
  const laserMap: LaserAreaPrice[] = (priceMapRes.data ?? []).map((m) => ({
    areaCodes: m.area_codes,
    gender: m.gender as Gender,
    singleItemCode: m.single_item_code,
    package3ItemCode: m.package3_item_code,
  }))

  // branch price: itemId -> (branchId -> price)
  const priceByItemBranch = new Map<string, Map<string, number>>()
  for (const row of branchPrices) {
    const p = toNum(row.price)
    if (p === null) continue
    let m = priceByItemBranch.get(row.item_id)
    if (!m) priceByItemBranch.set(row.item_id, (m = new Map()))
    m.set(row.branch_id, p)
  }
  // itemId -> [doctorId] (restricted items only)
  const doctorsByItem = new Map<string, string[]>()
  for (const row of itemDoctors) {
    const list = doctorsByItem.get(row.item_id) ?? []
    list.push(row.doctor_id)
    doctorsByItem.set(row.item_id, list)
  }

  /** Items offered in `branchId`: those with a price here or a textual price. */
  function priceItemsFor(branchId: string): PricedItem[] {
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

  const wizardBranches: WizardBranch[] = branches.map((branch) => {
    const serviceIds = new Set(
      branchServices.filter((bs) => bs.branch_id === branch.id).map((bs) => bs.service_id)
    )
    const branchServiceList = services.filter((s) => serviceIds.has(s.id))
    const branchRoomById = new Map(rooms.filter((r) => r.branch_id === branch.id).map((r) => [r.id, r.title]))

    const branchDoctors: WizardDoctor[] = doctors
      .filter((d) => d.branch_id === branch.id)
      .map((d) => ({
        doctor: {
          id: d.id,
          branchId: d.branch_id,
          code: d.code,
          displayName: d.display_name,
          defaultBookingStatus: d.default_booking_status,
          alwaysOpen: d.always_open,
          acceptsMen: d.accepts_men,
          laserMenAllowed: d.laser_men_allowed,
          menLaserAreaCodes: d.men_laser_area_codes,
          rejectsSmallAreasOnly: d.rejects_small_areas_only,
          noOverlap: d.no_overlap,
          specialty: d.specialty,
          notes: d.notes,
          personKey: d.person_key,
        },
        schedules: schedules
          .filter((s) => s.doctor_id === d.id)
          .map((s) => ({ weekday: s.weekday, startTime: s.start_time, endTime: s.end_time, kind: s.kind })),
        laserCutoffs: docCutoffs
          .filter((c) => c.doctor_id === d.id)
          .map((c) => ({ weekday: c.weekday, cutoff: c.cutoff })),
        rooms: doctorRooms
          .filter((r) => r.doctor_id === d.id && branchRoomById.has(r.room_id))
          .map((r) => ({ weekday: r.weekday, title: branchRoomById.get(r.room_id) as string })),
      }))

    const branchUpdates: DoctorUpdate[] = updates
      .filter((u) => u.branch_id === branch.id)
      .map((u) => ({
        id: u.id,
        doctorId: u.doctor_id,
        type: u.type,
        dateFrom: u.date_from,
        dateTo: u.date_to,
        atTime: u.at_time,
        weekdays: u.weekdays ?? [],
        segments: (u.segments as DoctorUpdate["segments"]) ?? [],
        note: u.note,
        createdAt: u.created_at,
      }))

    return {
      id: branch.id,
      code: branch.code,
      nameAr: branch.name_ar,
      hasTickets: branch.has_tickets,
      logoUrl: branch.logo_url,
      branchLaserCutoffs: branchCutoffs
        .filter((c) => c.branch_id === branch.id)
        .map((c) => ({ weekday: c.weekday, shiftStartsBefore: c.shift_starts_before, cutoff: c.cutoff })),
      services: branchServiceList.map((s) => ({
        code: s.code,
        usesLaserAreas: s.uses_laser_areas,
        defaultDurationMin: s.default_duration_min,
      })),
      serviceNames: Object.fromEntries(branchServiceList.map((s) => [s.code, s.name_ar])),
      doctors: branchDoctors,
      updates: branchUpdates,
      priceBook: { categories: priceCategories, items: priceItemsFor(branch.id), laserMap },
    }
  })

  return { todayStr, laserConfig, branches: wizardBranches }
}
