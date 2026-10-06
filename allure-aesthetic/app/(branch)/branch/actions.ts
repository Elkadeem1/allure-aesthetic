"use server"

import { createClient } from "@/lib/supabase/server"
import { mapRpcError } from "@/lib/booking/message"
import type { BranchResponse } from "@/lib/types/database.types"

export type ActionResult = { ok: true } | { ok: false; error: string }

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
