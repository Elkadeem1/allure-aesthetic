"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin, type ActionResult } from "@/lib/admin/guard"
import { mapRpcError } from "@/lib/booking/message"
import {
  doctorInputSchema,
  saveScheduleSchema,
  saveLaserCutoffsSchema,
  type DoctorInput,
} from "@/lib/admin/doctor-schema"
import type { Json } from "@/lib/types/database.types"

function revalidate() {
  revalidatePath("/admin/doctors")
  revalidatePath("/dashboard")
  revalidatePath("/admin")
}

/** Shared mapping from the validated input to the doctors row. */
function doctorRow(v: DoctorInput) {
  return {
    branch_id: v.branchId,
    display_name: v.displayName,
    specialty: v.specialty,
    notes: v.notes,
    person_key: v.personKey,
    always_open: v.alwaysOpen,
    default_booking_status: (v.alwaysOpen ? "open" : "confirmed") as "open" | "confirmed",
    accepts_men: v.acceptsMen,
    laser_men_allowed: v.laserMenAllowed,
    men_laser_area_codes: v.menLaserAreaCodes && v.menLaserAreaCodes.length > 0 ? v.menLaserAreaCodes : null,
    rejects_small_areas_only: v.rejectsSmallAreasOnly,
    no_overlap: v.noOverlap,
  }
}

export async function createDoctorAction(raw: DoctorInput): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const parsed = doctorInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة." }

  const { error: insErr } = await supabase.from("doctors").insert({
    ...doctorRow(parsed.data),
    code: `doc-${crypto.randomUUID().slice(0, 8)}`, // stable per-branch slug
  })
  if (insErr) return { ok: false, error: mapRpcError(insErr.message) }
  revalidate()
  return { ok: true }
}

export async function updateDoctorAction(doctorId: string, raw: DoctorInput): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const parsed = doctorInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة." }

  const { error: updErr } = await supabase.from("doctors").update(doctorRow(parsed.data)).eq("id", doctorId)
  if (updErr) return { ok: false, error: mapRpcError(updErr.message) }
  revalidate()
  return { ok: true }
}

/** Deactivate / reactivate — tickets reference doctors, so never delete. */
export async function setDoctorActiveAction(doctorId: string, isActive: boolean): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const { error: updErr } = await supabase.from("doctors").update({ is_active: isActive }).eq("id", doctorId)
  if (updErr) return { ok: false, error: mapRpcError(updErr.message) }
  revalidate()
  return { ok: true }
}

export async function saveScheduleAction(raw: {
  doctorId: string
  entries: { weekday: number; start: string; end: string; kind: string }[]
  rooms: { weekday: number; roomId: string }[]
}): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const parsed = saveScheduleSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "الجدول فيه مشكلة." }

  // One RPC = one transaction: schedule + rooms are replaced atomically.
  const { error: rpcErr } = await supabase.rpc("admin_save_doctor_schedule", {
    p_doctor_id: parsed.data.doctorId,
    p_segments: parsed.data.entries as unknown as Json,
    p_rooms: parsed.data.rooms as unknown as Json,
  })
  if (rpcErr) return { ok: false, error: mapRpcError(rpcErr.message) }
  revalidate()
  return { ok: true }
}

export async function saveLaserCutoffsAction(raw: {
  doctorId: string
  cutoffs: { weekday: number; cutoff: string }[]
}): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const parsed = saveLaserCutoffsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة." }

  const { error: delErr } = await supabase
    .from("doctor_laser_cutoffs")
    .delete()
    .eq("doctor_id", parsed.data.doctorId)
  if (delErr) return { ok: false, error: mapRpcError(delErr.message) }

  if (parsed.data.cutoffs.length > 0) {
    const { error: insErr } = await supabase.from("doctor_laser_cutoffs").insert(
      parsed.data.cutoffs.map((c) => ({
        doctor_id: parsed.data.doctorId,
        weekday: c.weekday,
        cutoff: c.cutoff,
      }))
    )
    if (insErr) return { ok: false, error: mapRpcError(insErr.message) }
  }
  revalidate()
  return { ok: true }
}
