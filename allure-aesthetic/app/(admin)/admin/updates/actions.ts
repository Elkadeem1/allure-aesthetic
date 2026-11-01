"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin, type ActionResult } from "@/lib/admin/guard"
import { mapRpcError } from "@/lib/booking/message"
import { updateInputSchema, type UpdateInput } from "@/lib/admin/update-schema"
import { cairoToday } from "@/lib/time"

function revalidate() {
  revalidatePath("/admin/updates")
  revalidatePath("/dashboard")
  revalidatePath("/admin")
}

export async function createDoctorUpdateAction(raw: UpdateInput): Promise<ActionResult> {
  const { supabase, userId, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const parsed = updateInputSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة." }
  }
  const v = parsed.data

  const { error: insErr } = await supabase.from("doctor_updates").insert({
    branch_id: v.branchId,
    doctor_id: v.doctorId,
    type: v.type,
    date_from: v.dateFrom,
    date_to: v.dateTo,
    weekdays: v.weekdays,
    at_time: v.type === "laser_stop" || v.type === "booking_cutoff" ? v.atTime : null,
    segments: v.type === "hours" ? v.segments : [],
    note: v.note,
    created_by: userId,
  })

  if (insErr) return { ok: false, error: mapRpcError(insErr.message) }
  revalidate()
  return { ok: true }
}

export async function deleteDoctorUpdateAction(updateId: string): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const { error: delErr } = await supabase.from("doctor_updates").delete().eq("id", updateId)
  if (delErr) return { ok: false, error: mapRpcError(delErr.message) }
  revalidate()
  return { ok: true }
}

/** "تنهي النهاردة" — stop an update after today (clamp date_to to today). */
export async function endUpdateTodayAction(updateId: string): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const today = cairoToday()
  // If it hasn't started yet, clamping date_to alone would break date_to >= date_from.
  const { data: row } = await supabase
    .from("doctor_updates")
    .select("date_from")
    .eq("id", updateId)
    .single()
  const dateFrom = row && row.date_from > today ? today : undefined

  const { error: updErr } = await supabase
    .from("doctor_updates")
    .update({ date_to: today, ...(dateFrom ? { date_from: dateFrom } : {}) })
    .eq("id", updateId)
  if (updErr) return { ok: false, error: mapRpcError(updErr.message) }
  revalidate()
  return { ok: true }
}
