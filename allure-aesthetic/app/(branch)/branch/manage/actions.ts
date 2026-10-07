"use server"

import { createClient } from "@/lib/supabase/server"
import { mapRpcError } from "@/lib/booking/message"
import type { UpdateType, ShiftKind } from "@/lib/types/database.types"

export type ActionResult = { ok: true } | { ok: false; error: string }

// --- Doctor update CRUD ---

export async function createDoctorUpdateAction(args: {
  branchId: string
  doctorId: string | null
  type: UpdateType
  dateFrom: string
  dateTo: string
  note?: string
  segments?: Array<{ start: string; end: string; kind?: ShiftKind }>
}): Promise<ActionResult> {
  if (!args.dateFrom || !args.dateTo) {
    return { ok: false, error: "لازم تحدد التاريخ." }
  }
  if (args.dateFrom > args.dateTo) {
    return { ok: false, error: "تاريخ البداية لازم يكون قبل أو يساوي تاريخ النهاية." }
  }

  if (args.type === "hours") {
    const segs = args.segments ?? []
    if (segs.length === 0) {
      return { ok: false, error: "لازم تحدد ساعات العمل." }
    }
    for (const seg of segs) {
      if (!seg.start || !seg.end) {
        return { ok: false, error: "كل فترة لازم يكون فيها وقت بداية ونهاية." }
      }
      if (seg.start >= seg.end) {
        return { ok: false, error: "وقت البداية لازم يكون قبل وقت النهاية." }
      }
    }
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        if (segs[i].start < segs[j].end && segs[j].start < segs[i].end) {
          return { ok: false, error: "الفترات متداخلة — راجعها." }
        }
      }
    }
  }

  if (args.type === "note" && !args.note?.trim()) {
    return { ok: false, error: "لازم تكتب الملاحظة." }
  }

  if (args.doctorId === null && !["off", "stop", "note"].includes(args.type)) {
    return { ok: false, error: "التحديث على الفرع كله لازم يكون: مقفول، حجز مكتمل، أو ملاحظة." }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "مش مسجل دخول." }

  const { error } = await supabase.from("doctor_updates").insert({
    branch_id: args.branchId,
    doctor_id: args.doctorId,
    type: args.type,
    date_from: args.dateFrom,
    date_to: args.dateTo,
    note: args.note?.trim() || null,
    segments: args.segments ?? null,
    created_by: user.id,
  })

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function deleteDoctorUpdateAction(
  updateId: string,
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("doctor_updates")
    .delete()
    .eq("id", updateId)

  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

// --- Schedule CRUD ---

export type ScheduleEntry = {
  id?: string
  doctorId: string
  weekday: number
  startTime: string
  endTime: string
  kind: ShiftKind
}

export async function saveScheduleAction(args: {
  doctorId: string
  entries: ScheduleEntry[]
}): Promise<ActionResult> {
  for (const entry of args.entries) {
    if (entry.weekday < 0 || entry.weekday > 6) {
      return { ok: false, error: "يوم غير صحيح." }
    }
    if (!entry.startTime || !entry.endTime) {
      return { ok: false, error: "كل فترة لازم يكون فيها وقت بداية ونهاية." }
    }
    if (entry.startTime >= entry.endTime) {
      return { ok: false, error: "وقت البداية لازم يكون قبل وقت النهاية." }
    }
  }

  const byDay = new Map<number, ScheduleEntry[]>()
  for (const entry of args.entries) {
    const list = byDay.get(entry.weekday) ?? []
    list.push(entry)
    byDay.set(entry.weekday, list)
  }
  for (const [, dayEntries] of byDay) {
    const sorted = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime))
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].endTime > sorted[i + 1].startTime) {
        return { ok: false, error: "فترات متداخلة في نفس اليوم — راجع الجدول." }
      }
    }
  }

  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from("doctor_schedules")
    .delete()
    .eq("doctor_id", args.doctorId)

  if (deleteError) return { ok: false, error: mapRpcError(deleteError.message) }

  if (args.entries.length > 0) {
    const { error: insertError } = await supabase
      .from("doctor_schedules")
      .insert(
        args.entries.map((e) => ({
          doctor_id: args.doctorId,
          weekday: e.weekday,
          start_time: e.startTime,
          end_time: e.endTime,
          kind: e.kind,
        })),
      )
    if (insertError) return { ok: false, error: mapRpcError(insertError.message) }
  }

  return { ok: true }
}
