"use server"

import { createClient } from "@/lib/supabase/server"
import { loadBookingData } from "@/lib/booking/data"
import { isEgyptMobile, mapRpcError } from "@/lib/booking/message"
import {
  companionMissing,
  evalDoctor,
  hhmm,
  resolveTicketKind,
  sessionMinutes,
  startSlots,
} from "@/lib/engine"
import type { ClientGender } from "@/lib/types/database.types"

export type SendTicketInput = {
  branchId: string
  doctorId: string
  serviceCode: string
  gender: ClientGender
  areaCodes: string[]
  date: string
  startMin: number
  customerName: string
  phone: string
  note?: string
}

export type SendTicketResult =
  | { ok: true; ticketNo: number; kind: "request" | "notice" }
  | { ok: false; error: string }

export async function sendTicket(input: SendTicketInput): Promise<SendTicketResult> {
  const name = input.customerName.trim()
  const phone = input.phone.trim()
  if (name.length === 0) return { ok: false, error: "اكتب اسم العميل." }
  if (!isEgyptMobile(phone)) return { ok: false, error: "رقم موبايل مصري غير صحيح." }

  // Re-load fresh data and re-validate on the server — the picture may have
  // changed since the agent started the wizard.
  const data = await loadBookingData()
  const branch = data.branches.find((b) => b.id === input.branchId)
  if (!branch) return { ok: false, error: "الفرع مش موجود." }

  const service = branch.services.find((s) => s.code === input.serviceCode)
  if (!service) return { ok: false, error: "الخدمة مش متاحة في الفرع ده." }

  const wd = branch.doctors.find((x) => x.doctor.id === input.doctorId)
  if (!wd) return { ok: false, error: "الدكتورة مش موجودة." }

  const ctx = {
    doctor: wd.doctor,
    schedules: wd.schedules,
    laserCutoffs: wd.laserCutoffs,
    branchLaserCutoffs: branch.branchLaserCutoffs,
    updates: branch.updates,
  }
  const evalArgs = {
    date: input.date,
    service,
    gender: input.gender,
    areas: input.areaCodes,
  }

  if (service.usesLaserAreas) {
    if (input.areaCodes.length === 0) return { ok: false, error: "اختار مناطق الليزر الأول." }
    if (companionMissing(input.areaCodes, data.laserConfig.areas)) {
      return { ok: false, error: "Bikini Line لازم تتحجز مع أريا تانية." }
    }
  }

  const ev = evalDoctor(ctx, evalArgs, data.laserConfig)
  if (!ev.ok) {
    return { ok: false, error: "الدكتورة بقت مش متاحة في الميعاد ده: " + ev.reasons.join("، ") }
  }

  const durationMin = sessionMinutes(service, input.areaCodes, data.laserConfig)
  const slots = startSlots(ctx, { date: input.date, service, durationMin }, data.laserConfig)
  if (!slots.includes(input.startMin)) {
    return { ok: false, error: "الوقت المختار مابقاش متاح — اختار وقت تاني." }
  }

  const decision = resolveTicketKind(
    wd.doctor,
    input.date,
    data.todayStr,
    branch.updates,
    branch.policy
  )
  if (decision.kind === null) {
    return { ok: false, error: mapRpcError("no_ticket_needed") }
  }

  const supabase = await createClient()
  const { data: ticket, error } = await supabase.rpc("create_ticket", {
    p_doctor_id: input.doctorId,
    p_service_code: input.serviceCode,
    p_customer_name: name,
    p_customer_phone: phone,
    p_customer_gender: input.gender,
    p_area_codes: input.areaCodes,
    p_appt_date: input.date,
    p_start_time: hhmm(input.startMin),
    p_end_time: hhmm(input.startMin + durationMin),
    p_agent_note: input.note?.trim() || null,
  })

  if (error || !ticket) return { ok: false, error: mapRpcError(error?.message) }
  return { ok: true, ticketNo: ticket.ticket_no, kind: ticket.kind as "request" | "notice" }
}
