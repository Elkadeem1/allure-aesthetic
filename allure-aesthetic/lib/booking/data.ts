// =====================================================================
// Server-side loader that shapes every table the booking engine needs into
// plain, serialisable objects. Used by the wizard page (to hydrate the client
// engine) and by the send action (to re-load fresh data and re-validate on the
// server). No rule logic lives here — only fetching + camelCase mapping.
// =====================================================================

import { createClient } from "@/lib/supabase/server"
import { cairoToday } from "@/lib/time"
import type {
  BranchLaserCutoff,
  BranchPolicy,
  Doctor,
  DoctorLaserCutoff,
  DoctorSchedule,
  DoctorUpdate,
  LaserConfig,
  Service,
} from "@/lib/engine"
import type { LaserPriceEntry } from "@/lib/engine/pricing"

export type WizardDoctor = {
  doctor: Doctor
  schedules: DoctorSchedule[]
  laserCutoffs: DoctorLaserCutoff[]
}

export type WizardBranch = {
  id: string
  code: string
  nameAr: string
  policy: BranchPolicy
  branchLaserCutoffs: BranchLaserCutoff[]
  services: Service[]
  serviceNames: Record<string, string> // code -> Arabic name
  doctors: WizardDoctor[]
  updates: DoctorUpdate[] // branch-wide + per-doctor, future-dated
  laserPrices: LaserPriceEntry[] // resolved for this branch's price list
}

export type BookingData = {
  todayStr: string
  slaMinutes: number // app_settings.sla_minutes — the branch reply window for REQUESTs
  laserConfig: LaserConfig
  branches: WizardBranch[]
}

const DEFAULT_POLICY: BranchPolicy = {
  requestWindowDays: 1,
  sameDayAlwaysRequest: false,
  autoConfirmWeekdays: [],
  allowOverlap: true,
}

export async function loadBookingData(): Promise<BookingData> {
  const supabase = await createClient()
  const todayStr = cairoToday()

  const [
    branchesRes,
    policiesRes,
    doctorsRes,
    schedulesRes,
    docCutoffsRes,
    branchCutoffsRes,
    updatesRes,
    branchServicesRes,
    servicesRes,
    areasRes,
    conflictsRes,
    combosRes,
    priceMapRes,
    priceItemsRes,
    settingsRes,
  ] = await Promise.all([
    supabase
      .from("branches")
      .select("id, code, name_ar, price_list_id, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase
      .from("branch_policies")
      .select(
        "branch_id, request_window_days, same_day_always_request, auto_confirm_weekdays, allow_overlap"
      ),
    supabase
      .from("doctors")
      .select(
        "id, branch_id, display_name, default_booking_status, accepts_men, laser_men_allowed, men_laser_area_codes, rejects_small_areas_only, no_overlap, notes, sort"
      )
      .eq("is_active", true)
      .order("sort"),
    supabase.from("doctor_schedules").select("doctor_id, weekday, start_time, end_time, kind"),
    supabase.from("doctor_laser_cutoffs").select("doctor_id, weekday, cutoff"),
    supabase.from("branch_laser_cutoffs").select("branch_id, weekday, shift_starts_before, cutoff"),
    supabase
      .from("doctor_updates")
      .select("id, branch_id, doctor_id, type, date_from, date_to, note, segments, created_at")
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
      .select(
        "code, gender, name_en, hint_ar, duration_min, is_small, is_full_body, requires_companion, sort"
      )
      .order("sort"),
    supabase.from("laser_area_conflicts").select("area_code, conflicts_with"),
    supabase
      .from("laser_area_combos")
      .select("label, required_codes, any_of_codes, duration_adjust_min, sort")
      .order("sort"),
    supabase.from("laser_price_map").select("price_list_id, area_codes, single_item_id, package3_item_id"),
    supabase.from("price_items").select("id, name, price"),
    supabase.from("app_settings").select("sla_minutes").maybeSingle(),
  ])

  const branches = branchesRes.data ?? []
  const policies = policiesRes.data ?? []
  const doctors = doctorsRes.data ?? []
  const schedules = schedulesRes.data ?? []
  const docCutoffs = docCutoffsRes.data ?? []
  const branchCutoffs = branchCutoffsRes.data ?? []
  const updates = updatesRes.data ?? []
  const branchServices = branchServicesRes.data ?? []
  const services = servicesRes.data ?? []
  const items = priceItemsRes.data ?? []

  const laserConfig: LaserConfig = {
    areas: (areasRes.data ?? []).map((a) => ({
      code: a.code,
      gender: a.gender,
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

  const itemById = new Map(items.map((i) => [i.id, i]))
  const priceEntriesByList = new Map<string, LaserPriceEntry[]>()
  for (const row of priceMapRes.data ?? []) {
    const single = itemById.get(row.single_item_id)
    if (!single || single.price === null) continue
    const pkg = row.package3_item_id ? itemById.get(row.package3_item_id) : null
    const entry: LaserPriceEntry = {
      areaCodes: row.area_codes,
      label: single.name,
      single: Number(single.price),
      package3: pkg && pkg.price !== null ? Number(pkg.price) : null,
    }
    const list = priceEntriesByList.get(row.price_list_id) ?? []
    list.push(entry)
    priceEntriesByList.set(row.price_list_id, list)
  }

  const wizardBranches: WizardBranch[] = branches.map((branch) => {
    const policyRow = policies.find((p) => p.branch_id === branch.id)
    const policy: BranchPolicy = policyRow
      ? {
          requestWindowDays: policyRow.request_window_days,
          sameDayAlwaysRequest: policyRow.same_day_always_request,
          autoConfirmWeekdays: policyRow.auto_confirm_weekdays,
          allowOverlap: policyRow.allow_overlap,
        }
      : DEFAULT_POLICY

    const serviceIds = new Set(
      branchServices.filter((bs) => bs.branch_id === branch.id).map((bs) => bs.service_id)
    )
    const branchServiceList = services.filter((s) => serviceIds.has(s.id))

    const branchDoctors: WizardDoctor[] = doctors
      .filter((d) => d.branch_id === branch.id)
      .map((d) => ({
        doctor: {
          id: d.id,
          branchId: d.branch_id,
          displayName: d.display_name,
          defaultBookingStatus: d.default_booking_status,
          acceptsMen: d.accepts_men,
          laserMenAllowed: d.laser_men_allowed,
          menLaserAreaCodes: d.men_laser_area_codes,
          rejectsSmallAreasOnly: d.rejects_small_areas_only,
          noOverlap: d.no_overlap,
          notes: d.notes,
        },
        schedules: schedules
          .filter((s) => s.doctor_id === d.id)
          .map((s) => ({
            weekday: s.weekday,
            startTime: s.start_time,
            endTime: s.end_time,
            kind: s.kind,
          })),
        laserCutoffs: docCutoffs
          .filter((c) => c.doctor_id === d.id)
          .map((c) => ({ weekday: c.weekday, cutoff: c.cutoff })),
      }))

    const branchUpdates: DoctorUpdate[] = updates
      .filter((u) => u.branch_id === branch.id)
      .map((u) => ({
        id: u.id,
        doctorId: u.doctor_id,
        type: u.type,
        dateFrom: u.date_from,
        dateTo: u.date_to,
        segments: (u.segments as DoctorUpdate["segments"]) ?? [],
        note: u.note,
        createdAt: u.created_at,
      }))

    return {
      id: branch.id,
      code: branch.code,
      nameAr: branch.name_ar,
      policy,
      branchLaserCutoffs: branchCutoffs
        .filter((c) => c.branch_id === branch.id)
        .map((c) => ({
          weekday: c.weekday,
          shiftStartsBefore: c.shift_starts_before,
          cutoff: c.cutoff,
        })),
      services: branchServiceList.map((s) => ({
        code: s.code,
        usesLaserAreas: s.uses_laser_areas,
        defaultDurationMin: s.default_duration_min,
      })),
      serviceNames: Object.fromEntries(branchServiceList.map((s) => [s.code, s.name_ar])),
      doctors: branchDoctors,
      updates: branchUpdates,
      laserPrices: branch.price_list_id
        ? priceEntriesByList.get(branch.price_list_id) ?? []
        : [],
    }
  })

  // 5 mirrors the column default in app_settings; only used if the row is missing.
  const slaMinutes = settingsRes.data?.sla_minutes ?? 5

  return { todayStr, slaMinutes, laserConfig, branches: wizardBranches }
}
