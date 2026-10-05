"use server"

import { createClient } from "@/lib/supabase/server"
import { mapRpcError } from "@/lib/booking/message"
import type { TicketOutcome } from "@/lib/types/database.types"

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function closeTicketAction(
  ticketId: string,
  outcome: TicketOutcome,
  note?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("close_ticket", {
    p_ticket_id: ticketId,
    p_outcome: outcome,
    p_note: note?.trim() || null,
  })
  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}

export async function cancelTicketAction(
  ticketId: string,
  reason: string
): Promise<ActionResult> {
  if (reason.trim().length === 0) return { ok: false, error: "لازم تكتب سبب الإلغاء." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_ticket", {
    p_ticket_id: ticketId,
    p_reason: reason.trim(),
  })
  if (error) return { ok: false, error: mapRpcError(error.message) }
  return { ok: true }
}
