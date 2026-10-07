"use server"

import { createClient } from "@/lib/supabase/server"
import { mapRpcError } from "@/lib/booking/message"
import { cairoToday } from "@/lib/time"
import type { BranchResponse } from "@/lib/types/database.types"

export type ActionResult = { ok: true } | { ok: false; error: string }

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(s)
}

export async function branchRespondAction(args: {
  ticketId: string
  response: BranchResponse
  responderName: string
  note?: string
  counterDate?: string
  counterStartTime?: string
  counterDoctorId?: string
}): Promise<ActionResult> {
  if (!args.responderName.trim()) return { ok: false, error: "لازم تكتب اسمك الأول." }

  if (args.response === "counter_offer") {
    if (!args.counterDate || !args.counterStartTime) {
      return { ok: false, error: "الميعاد البديل لازم يكون فيه تاريخ ووقت." }
    }
    if (!isValidDate(args.counterDate) || !isValidTime(args.counterStartTime)) {
      return { ok: false, error: "التاريخ أو الوقت مش صحيح." }
    }
    if (args.counterDate < cairoToday()) {
      return { ok: false, error: "الميعاد البديل لازم يكون النهاردة أو بعد كده." }
    }
  }
  if (args.response === "unavailable" && !args.note?.trim()) {
    return { ok: false, error: "لازم تكتب سبب عدم التوفر." }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("branch_respond", {
    p_ticket_id: args.ticketId,
    p_response: args.response,
    p_responder_name: args.responderName.trim(),
    p_note: args.note?.trim() || null,
    p_counter_date: args.counterDate || null,
    p_counter_start_time: args.counterStartTime || null,
    p_counter_doctor_id: args.counterDoctorId || null,
  })
  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function acknowledgeNoticeAction(
  ticketId: string,
  responderName: string,
): Promise<ActionResult> {
  if (!responderName.trim()) return { ok: false, error: "لازم تكتب اسمك الأول." }

  const supabase = await createClient()
  const { error } = await supabase.rpc("acknowledge_notice", {
    p_ticket_id: ticketId,
    p_responder_name: responderName.trim(),
  })
  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}
