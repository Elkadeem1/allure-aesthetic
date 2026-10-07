"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapRpcError } from "@/lib/booking/message"
import type {
  AppRole,
  BookingStatus,
  ConsultationKind,
  ShiftKind,
} from "@/lib/types/database.types"

export type ActionResult = { ok: true } | { ok: false; error: string }

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null as never, error: "مش مسجل دخول." as string }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "admin") return { supabase, user: null as never, error: "غير مصرح." as string }
  return { supabase, user, error: null }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function createUserAction(args: {
  email: string
  password: string
  fullName: string
  role: AppRole
  branchId: string | null
}): Promise<ActionResult> {
  const { error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  if (!args.email || !args.password || !args.fullName || !args.role) {
    return { ok: false, error: "كل الحقول مطلوبة." }
  }
  if (args.password.length < 6) {
    return { ok: false, error: "كلمة المرور لازم تكون 6 حروف على الأقل." }
  }
  if (args.role === "branch" && !args.branchId) {
    return { ok: false, error: "مستخدم الفرع لازم يكون مرتبط بفرع." }
  }
  if (args.role !== "branch" && args.branchId) {
    return { ok: false, error: "المستخدم مش فرع — مينفعش يكون مرتبط بفرع." }
  }

  const admin = createAdminClient()
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: args.email,
    password: args.password,
    email_confirm: true,
  })
  if (createError) return { ok: false, error: createError.message }

  const { error: profileError } = await admin.from("profiles").insert({
    id: newUser.user.id,
    full_name: args.fullName,
    role: args.role,
    branch_id: args.branchId,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(newUser.user.id)
    return { ok: false, error: mapRpcError(profileError.message) }
  }

  return { ok: true }
}

export async function updateUserAction(args: {
  userId: string
  fullName: string
  role: AppRole
  branchId: string | null
  isActive: boolean
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  if (args.role === "branch" && !args.branchId) {
    return { ok: false, error: "مستخدم الفرع لازم يكون مرتبط بفرع." }
  }
  if (args.role !== "branch" && args.branchId) {
    return { ok: false, error: "المستخدم مش فرع — مينفعش يكون مرتبط بفرع." }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: args.fullName,
      role: args.role,
      branch_id: args.branchId,
      is_active: args.isActive,
    })
    .eq("id", args.userId)

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function resetPasswordAction(args: {
  userId: string
  newPassword: string
}): Promise<ActionResult> {
  const { error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  if (args.newPassword.length < 6) {
    return { ok: false, error: "كلمة المرور لازم تكون 6 حروف على الأقل." }
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(args.userId, {
    password: args.newPassword,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export async function createBranchAction(args: {
  code: string
  nameAr: string
  address: string | null
  paymentMethods: string[]
  priceListId: string | null
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  if (!args.code || !args.nameAr) {
    return { ok: false, error: "الكود والاسم مطلوبين." }
  }

  const { data: branch, error } = await supabase
    .from("branches")
    .insert({
      code: args.code.trim(),
      name_ar: args.nameAr.trim(),
      address: args.address?.trim() || null,
      payment_methods: args.paymentMethods,
      price_list_id: args.priceListId,
    })
    .select("id")
    .single()

  if (error) return { ok: false, error: mapRpcError(error.message) }

  await supabase.from("branch_policies").insert({ branch_id: branch.id })

  return { ok: true }
}

export async function updateBranchAction(args: {
  branchId: string
  code: string
  nameAr: string
  address: string | null
  paymentMethods: string[]
  priceListId: string | null
  isActive: boolean
  sort: number
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error } = await supabase
    .from("branches")
    .update({
      code: args.code.trim(),
      name_ar: args.nameAr.trim(),
      address: args.address?.trim() || null,
      payment_methods: args.paymentMethods,
      price_list_id: args.priceListId,
      is_active: args.isActive,
      sort: args.sort,
    })
    .eq("id", args.branchId)

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function updateBranchPoliciesAction(args: {
  branchId: string
  requestWindowDays: number
  sameDayAlwaysRequest: boolean
  autoConfirmWeekdays: number[]
  allowOverlap: boolean
  bookingRules: string[]
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error } = await supabase
    .from("branch_policies")
    .update({
      request_window_days: args.requestWindowDays,
      same_day_always_request: args.sameDayAlwaysRequest,
      auto_confirm_weekdays: args.autoConfirmWeekdays,
      allow_overlap: args.allowOverlap,
      booking_rules: args.bookingRules,
    })
    .eq("branch_id", args.branchId)

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function updateBranchServicesAction(args: {
  branchId: string
  serviceIds: string[]
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error: deleteError } = await supabase
    .from("branch_services")
    .delete()
    .eq("branch_id", args.branchId)
  if (deleteError) return { ok: false, error: mapRpcError(deleteError.message) }

  if (args.serviceIds.length > 0) {
    const { error: insertError } = await supabase
      .from("branch_services")
      .insert(args.serviceIds.map((sid) => ({ branch_id: args.branchId, service_id: sid })))
    if (insertError) return { ok: false, error: mapRpcError(insertError.message) }
  }

  return { ok: true }
}

export async function saveBranchLaserCutoffsAction(args: {
  branchId: string
  cutoffs: Array<{ weekday: number; shiftStartsBefore: string; cutoff: string }>
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error: delError } = await supabase
    .from("branch_laser_cutoffs")
    .delete()
    .eq("branch_id", args.branchId)
  if (delError) return { ok: false, error: mapRpcError(delError.message) }

  if (args.cutoffs.length > 0) {
    const { error: insError } = await supabase
      .from("branch_laser_cutoffs")
      .insert(args.cutoffs.map((c) => ({
        branch_id: args.branchId,
        weekday: c.weekday,
        shift_starts_before: c.shiftStartsBefore,
        cutoff: c.cutoff,
      })))
    if (insError) return { ok: false, error: mapRpcError(insError.message) }
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------

export async function createDoctorAction(args: {
  branchId: string
  code: string
  displayName: string
  personKey: string | null
  defaultBookingStatus: BookingStatus
  acceptsMen: boolean
  laserMenAllowed: boolean
  menLaserAreaCodes: string[] | null
  rejectsSmallAreasOnly: boolean
  noOverlap: boolean
  notes: string | null
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  if (!args.code || !args.displayName || !args.branchId) {
    return { ok: false, error: "الكود والاسم والفرع مطلوبين." }
  }

  const { error } = await supabase.from("doctors").insert({
    branch_id: args.branchId,
    code: args.code.trim(),
    display_name: args.displayName.trim(),
    person_key: args.personKey?.trim() || null,
    default_booking_status: args.defaultBookingStatus,
    accepts_men: args.acceptsMen,
    laser_men_allowed: args.laserMenAllowed,
    men_laser_area_codes: args.menLaserAreaCodes,
    rejects_small_areas_only: args.rejectsSmallAreasOnly,
    no_overlap: args.noOverlap,
    notes: args.notes?.trim() || null,
  })

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function updateDoctorAction(args: {
  doctorId: string
  code: string
  displayName: string
  personKey: string | null
  defaultBookingStatus: BookingStatus
  acceptsMen: boolean
  laserMenAllowed: boolean
  menLaserAreaCodes: string[] | null
  rejectsSmallAreasOnly: boolean
  noOverlap: boolean
  notes: string | null
  isActive: boolean
  sort: number
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error } = await supabase
    .from("doctors")
    .update({
      code: args.code.trim(),
      display_name: args.displayName.trim(),
      person_key: args.personKey?.trim() || null,
      default_booking_status: args.defaultBookingStatus,
      accepts_men: args.acceptsMen,
      laser_men_allowed: args.laserMenAllowed,
      men_laser_area_codes: args.menLaserAreaCodes,
      rejects_small_areas_only: args.rejectsSmallAreasOnly,
      no_overlap: args.noOverlap,
      notes: args.notes?.trim() || null,
      is_active: args.isActive,
      sort: args.sort,
    })
    .eq("id", args.doctorId)

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function saveDoctorScheduleAction(args: {
  doctorId: string
  entries: Array<{
    weekday: number
    startTime: string
    endTime: string
    kind: ShiftKind
  }>
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  for (const e of args.entries) {
    if (e.weekday < 0 || e.weekday > 6) return { ok: false, error: "يوم غير صحيح." }
    if (!e.startTime || !e.endTime) return { ok: false, error: "لازم تحدد وقت البداية والنهاية." }
    if (e.startTime >= e.endTime) return { ok: false, error: "وقت البداية لازم يكون قبل وقت النهاية." }
  }

  const { error: delError } = await supabase
    .from("doctor_schedules")
    .delete()
    .eq("doctor_id", args.doctorId)
  if (delError) return { ok: false, error: mapRpcError(delError.message) }

  if (args.entries.length > 0) {
    const { error: insError } = await supabase
      .from("doctor_schedules")
      .insert(args.entries.map((e) => ({
        doctor_id: args.doctorId,
        weekday: e.weekday,
        start_time: e.startTime,
        end_time: e.endTime,
        kind: e.kind,
      })))
    if (insError) return { ok: false, error: mapRpcError(insError.message) }
  }

  return { ok: true }
}

export async function saveDoctorLaserCutoffsAction(args: {
  doctorId: string
  cutoffs: Array<{ weekday: number; cutoff: string }>
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error: delError } = await supabase
    .from("doctor_laser_cutoffs")
    .delete()
    .eq("doctor_id", args.doctorId)
  if (delError) return { ok: false, error: mapRpcError(delError.message) }

  if (args.cutoffs.length > 0) {
    const { error: insError } = await supabase
      .from("doctor_laser_cutoffs")
      .insert(args.cutoffs.map((c) => ({
        doctor_id: args.doctorId,
        weekday: c.weekday,
        cutoff: c.cutoff,
      })))
    if (insError) return { ok: false, error: mapRpcError(insError.message) }
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export async function createServiceAction(args: {
  code: string
  nameAr: string
  nameEn: string
  defaultDurationMin: number
  usesLaserAreas: boolean
  kbSlug: string | null
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  if (!args.code || !args.nameAr || !args.nameEn) {
    return { ok: false, error: "الكود والاسم مطلوبين." }
  }

  const { error } = await supabase.from("services").insert({
    code: args.code.trim(),
    name_ar: args.nameAr.trim(),
    name_en: args.nameEn.trim(),
    default_duration_min: args.defaultDurationMin,
    uses_laser_areas: args.usesLaserAreas,
    kb_slug: args.kbSlug?.trim() || null,
  })

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function updateServiceAction(args: {
  serviceId: string
  code: string
  nameAr: string
  nameEn: string
  defaultDurationMin: number
  usesLaserAreas: boolean
  kbSlug: string | null
  isActive: boolean
  sort: number
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error } = await supabase
    .from("services")
    .update({
      code: args.code.trim(),
      name_ar: args.nameAr.trim(),
      name_en: args.nameEn.trim(),
      default_duration_min: args.defaultDurationMin,
      uses_laser_areas: args.usesLaserAreas,
      kb_slug: args.kbSlug?.trim() || null,
      is_active: args.isActive,
      sort: args.sort,
    })
    .eq("id", args.serviceId)

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Laser areas
// ---------------------------------------------------------------------------

export async function createLaserAreaAction(args: {
  code: string
  gender: "female" | "male"
  nameEn: string
  hintAr: string | null
  durationMin: number
  isSmall: boolean
  isFullBody: boolean
  requiresCompanion: boolean
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  if (!args.code || !args.nameEn) {
    return { ok: false, error: "الكود والاسم مطلوبين." }
  }

  const { error } = await supabase.from("laser_areas").insert({
    code: args.code.trim(),
    gender: args.gender,
    name_en: args.nameEn.trim(),
    hint_ar: args.hintAr?.trim() || null,
    duration_min: args.durationMin,
    is_small: args.isSmall,
    is_full_body: args.isFullBody,
    requires_companion: args.requiresCompanion,
  })

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function updateLaserAreaAction(args: {
  code: string
  nameEn: string
  hintAr: string | null
  durationMin: number
  isSmall: boolean
  isFullBody: boolean
  requiresCompanion: boolean
  sort: number
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error } = await supabase
    .from("laser_areas")
    .update({
      name_en: args.nameEn.trim(),
      hint_ar: args.hintAr?.trim() || null,
      duration_min: args.durationMin,
      is_small: args.isSmall,
      is_full_body: args.isFullBody,
      requires_companion: args.requiresCompanion,
      sort: args.sort,
    })
    .eq("code", args.code)

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export async function createPriceListAction(args: {
  code: string
  name: string
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  if (!args.code || !args.name) return { ok: false, error: "الكود والاسم مطلوبين." }

  const { error } = await supabase.from("price_lists").insert({
    code: args.code.trim(),
    name: args.name.trim(),
  })

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function updatePriceListAction(args: {
  priceListId: string
  code: string
  name: string
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error } = await supabase
    .from("price_lists")
    .update({ code: args.code.trim(), name: args.name.trim() })
    .eq("id", args.priceListId)

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function createPriceCategoryAction(args: {
  priceListId: string
  name: string
  infoNote: string | null
  kbSlug: string | null
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  if (!args.name) return { ok: false, error: "اسم الفئة مطلوب." }

  const { error } = await supabase.from("price_categories").insert({
    price_list_id: args.priceListId,
    name: args.name.trim(),
    info_note: args.infoNote?.trim() || null,
    kb_slug: args.kbSlug?.trim() || null,
  })

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function updatePriceCategoryAction(args: {
  categoryId: string
  name: string
  infoNote: string | null
  kbSlug: string | null
  sort: number
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error } = await supabase
    .from("price_categories")
    .update({
      name: args.name.trim(),
      info_note: args.infoNote?.trim() || null,
      kb_slug: args.kbSlug?.trim() || null,
      sort: args.sort,
    })
    .eq("id", args.categoryId)

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function deletePriceCategoryAction(categoryId: string): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error } = await supabase
    .from("price_categories")
    .delete()
    .eq("id", categoryId)

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function createPriceItemAction(args: {
  categoryId: string
  name: string
  price: number | null
  priceText: string | null
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  if (!args.name) return { ok: false, error: "اسم البند مطلوب." }

  const { error } = await supabase.from("price_items").insert({
    category_id: args.categoryId,
    name: args.name.trim(),
    price: args.price,
    price_text: args.priceText?.trim() || null,
  })

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function updatePriceItemAction(args: {
  itemId: string
  name: string
  price: number | null
  priceText: string | null
  sort: number
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error } = await supabase
    .from("price_items")
    .update({
      name: args.name.trim(),
      price: args.price,
      price_text: args.priceText?.trim() || null,
      sort: args.sort,
    })
    .eq("id", args.itemId)

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function deletePriceItemAction(itemId: string): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error } = await supabase.from("price_items").delete().eq("id", itemId)
  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function saveConsultationPricesAction(args: {
  branchId: string
  prices: Array<{ doctorId: string | null; kind: ConsultationKind; price: number }>
}): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  const { error: delError } = await supabase
    .from("consultation_prices")
    .delete()
    .eq("branch_id", args.branchId)
  if (delError) return { ok: false, error: mapRpcError(delError.message) }

  if (args.prices.length > 0) {
    const { error: insError } = await supabase
      .from("consultation_prices")
      .insert(args.prices.map((p) => ({
        branch_id: args.branchId,
        doctor_id: p.doctorId,
        kind: p.kind,
        price: p.price,
      })))
    if (insError) return { ok: false, error: mapRpcError(insError.message) }
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateSlaMinutesAction(slaMinutes: number): Promise<ActionResult> {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { ok: false, error: authError }

  if (slaMinutes < 1 || slaMinutes > 120) {
    return { ok: false, error: "SLA لازم تكون بين 1 و 120 دقيقة." }
  }

  const { error } = await supabase
    .from("app_settings")
    .update({ sla_minutes: slaMinutes })
    .eq("id", true)

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}
