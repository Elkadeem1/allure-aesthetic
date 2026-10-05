// =====================================================================
// Ticket-kind decision preview.
//
// This MIRRORS the SQL exactly (migration 5: effective_booking_status +
// resolve_ticket_kind). It is a PREVIEW only — the server RPC remains the
// single source of truth. Keep the two in lockstep; do not add rules here.
//
//   * Confirmed doctor                 -> NOTICE  (dentolize Confirmed)
//   * Open doctor, today or tomorrow   -> REQUEST (dentolize Open)
//   * Open doctor, any later day       -> NO ticket (kind = null)
//   * Branch open_slot/force_open override for a date wins over everything
//     except the same-day branch rule.
// =====================================================================

import type { BookingStatus, BranchPolicy, Doctor, DoctorUpdate, TicketKind } from "./types"
import { dayDiff, weekdaySat0 } from "./time"

export type Decision = {
  kind: TicketKind | null // null = no ticket needed (book Open, branch confirms later)
  dentolizeStatus: BookingStatus
  reason: string
}

/** Mirrors public.effective_booking_status(p_doctor_id, p_date). */
export function effectiveBookingStatus(
  doctor: Doctor,
  date: string,
  updates: DoctorUpdate[],
  policy: BranchPolicy
): BookingStatus {
  // Latest doctor-specific status override wins.
  const override = updates
    .filter(
      (u) =>
        u.doctorId === doctor.id &&
        (u.type === "open_slot" || u.type === "force_open") &&
        u.dateFrom <= date &&
        date <= u.dateTo
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))[0]

  if (override?.type === "open_slot") return "confirmed"
  if (override?.type === "force_open") return "open"

  if (doctor.defaultBookingStatus === "open") {
    if (policy.autoConfirmWeekdays.includes(weekdaySat0(date))) return "confirmed"
  }
  return doctor.defaultBookingStatus
}

/** Mirrors public.resolve_ticket_kind(p_doctor_id, p_date). `today` = cairo_today(). */
export function resolveTicketKind(
  doctor: Doctor,
  date: string,
  today: string,
  updates: DoctorUpdate[],
  policy: BranchPolicy
): Decision {
  const diff = dayDiff(date, today)

  if (policy.sameDayAlwaysRequest && diff === 0) {
    return { kind: "request", dentolizeStatus: "open", reason: "same_day_branch_rule" }
  }

  const status = effectiveBookingStatus(doctor, date, updates, policy)

  if (status === "confirmed") {
    return {
      kind: "notice",
      dentolizeStatus: "confirmed",
      reason: doctor.defaultBookingStatus === "open" ? "open_turned_confirmed" : "doctor_confirmed",
    }
  }

  const windowDays = policy.requestWindowDays ?? 1
  if (diff <= windowDays) {
    return {
      kind: "request",
      dentolizeStatus: "open",
      reason:
        doctor.defaultBookingStatus === "confirmed"
          ? "confirmed_turned_open"
          : "open_doctor_today_tomorrow",
    }
  }

  // Open doctor, later day: book Open in Dentolize, no ticket.
  return { kind: null, dentolizeStatus: "open", reason: "open_later_no_ticket" }
}
