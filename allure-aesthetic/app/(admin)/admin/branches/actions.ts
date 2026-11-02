"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin, type ActionResult } from "@/lib/admin/guard"
import { mapRpcError } from "@/lib/booking/message"
import {
  branchInputSchema,
  saveRoomsSchema,
  saveBranchCutoffsSchema,
  type BranchInput,
} from "@/lib/admin/branch-schema"

function revalidate() {
  revalidatePath("/admin/branches")
  revalidatePath("/dashboard")
  revalidatePath("/admin")
}

export async function updateBranchAction(raw: BranchInput): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const parsed = branchInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة." }
  const v = parsed.data

  const { error: updErr } = await supabase
    .from("branches")
    .update({
      name_ar: v.nameAr,
      address: v.address,
      payment_methods: v.paymentMethods,
      managers: v.managers,
      has_tickets: v.hasTickets,
      logo_url: v.logoUrl,
      is_active: v.isActive,
    })
    .eq("id", v.branchId)
  if (updErr) return { ok: false, error: mapRpcError(updErr.message) }

  // Booking rules live on branch_policies (ordered list of display lines).
  const { error: polErr } = await supabase
    .from("branch_policies")
    .upsert({ branch_id: v.branchId, booking_rules: v.bookingRules }, { onConflict: "branch_id" })
  if (polErr) return { ok: false, error: mapRpcError(polErr.message) }

  revalidate()
  return { ok: true }
}

export async function saveRoomsAction(raw: {
  branchId: string
  rooms: { id: string | null; code: string; title: string; sort: number; isActive: boolean }[]
}): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const parsed = saveRoomsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة." }
  const { branchId, rooms } = parsed.data

  // Update existing rooms; insert new ones. Never delete (doctor_rooms / history).
  for (const r of rooms) {
    if (r.id) {
      const { error: e } = await supabase
        .from("rooms")
        .update({ code: r.code, title: r.title, sort: r.sort, is_active: r.isActive })
        .eq("id", r.id)
      if (e) return { ok: false, error: mapRpcError(e.message) }
    } else {
      const { error: e } = await supabase
        .from("rooms")
        .insert({ branch_id: branchId, code: r.code, title: r.title, sort: r.sort, is_active: r.isActive })
      if (e) return { ok: false, error: mapRpcError(e.message) }
    }
  }
  revalidate()
  return { ok: true }
}

export async function saveBranchCutoffsAction(raw: {
  branchId: string
  cutoffs: { weekday: number; shiftStartsBefore: string; cutoff: string }[]
}): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const parsed = saveBranchCutoffsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة." }
  const { branchId, cutoffs } = parsed.data

  const { error: delErr } = await supabase.from("branch_laser_cutoffs").delete().eq("branch_id", branchId)
  if (delErr) return { ok: false, error: mapRpcError(delErr.message) }

  if (cutoffs.length > 0) {
    const { error: insErr } = await supabase.from("branch_laser_cutoffs").insert(
      cutoffs.map((c) => ({
        branch_id: branchId,
        weekday: c.weekday,
        shift_starts_before: c.shiftStartsBefore,
        cutoff: c.cutoff,
      }))
    )
    if (insErr) return { ok: false, error: mapRpcError(insErr.message) }
  }
  revalidate()
  return { ok: true }
}
