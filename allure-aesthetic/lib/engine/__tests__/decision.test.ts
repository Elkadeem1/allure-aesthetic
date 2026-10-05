import { describe, expect, it } from "vitest"
import { resolveTicketKind } from "../decision"
import type { DoctorUpdate } from "../types"
import { HEBA, KHOLOUD, NOURHAN, MON, SAT, THU, TUE, WED, TANTA1_POLICY, TANTA2_POLICY } from "./fixtures"

const statusUpdate = (
  doctorId: string,
  type: "open_slot" | "force_open",
  date: string
): DoctorUpdate => ({
  id: `u-${type}`,
  doctorId,
  type,
  dateFrom: date,
  dateTo: date,
  segments: [],
  note: null,
  createdAt: "2026-10-01T00:00:00Z",
})

describe("resolveTicketKind — mirrors the SQL resolve_ticket_kind", () => {
  it("Tanta 1 Saturday: Open doctor auto-confirmed -> notice", () => {
    expect(resolveTicketKind(HEBA, SAT, SAT, [], TANTA1_POLICY)).toEqual({
      kind: "notice",
      dentolizeStatus: "confirmed",
      reason: "open_turned_confirmed",
    })
  })

  it("branch force_open for today overrides auto-confirm -> request/Open", () => {
    const updates = [statusUpdate(HEBA.id, "force_open", SAT)]
    expect(resolveTicketKind(HEBA, SAT, SAT, updates, TANTA1_POLICY)).toEqual({
      kind: "request",
      dentolizeStatus: "open",
      reason: "open_doctor_today_tomorrow",
    })
  })

  it("branch open_slot for tomorrow -> notice/Confirmed", () => {
    const updates = [statusUpdate(HEBA.id, "open_slot", TUE)]
    expect(resolveTicketKind(HEBA, TUE, MON, updates, TANTA1_POLICY)).toEqual({
      kind: "notice",
      dentolizeStatus: "confirmed",
      reason: "open_turned_confirmed",
    })
  })

  it("Open doctor after tomorrow -> no ticket", () => {
    // today = Monday, appointment = Thursday (not a Saturday, 3 days out)
    expect(resolveTicketKind(HEBA, THU, MON, [], TANTA1_POLICY)).toEqual({
      kind: null,
      dentolizeStatus: "open",
      reason: "open_later_no_ticket",
    })
  })

  it("Confirmed doctor -> notice", () => {
    expect(resolveTicketKind(KHOLOUD, WED, MON, [], TANTA1_POLICY)).toEqual({
      kind: "notice",
      dentolizeStatus: "confirmed",
      reason: "doctor_confirmed",
    })
  })

  it("Tanta 2 same-day rule forces a request even for a Confirmed doctor", () => {
    expect(resolveTicketKind(NOURHAN, MON, MON, [], TANTA2_POLICY)).toEqual({
      kind: "request",
      dentolizeStatus: "open",
      reason: "same_day_branch_rule",
    })
  })
})
