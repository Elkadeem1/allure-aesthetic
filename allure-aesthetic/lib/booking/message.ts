// Booking-side copy helpers: Egyptian phone validation, the WhatsApp fallback
// message (MVP style), decision-card presentation, and RPC error -> Arabic.

import { DAY_LABELS, tLabel, weekdaySat0 } from "@/lib/engine"
import { formatNumber } from "@/lib/format"
import type { Gender, LaserConfig, TicketKind } from "@/lib/engine"

// Egyptian mobile: 010 / 011 / 012 / 015 + 8 digits.
const EGYPT_MOBILE = /^01[0125]\d{8}$/
export function isEgyptMobile(phone: string): boolean {
  return EGYPT_MOBILE.test(phone.trim())
}

function areaLabel(code: string, cfg: LaserConfig): string {
  const a = cfg.areas.find((x) => x.code === code)
  return a?.hintAr ?? a?.nameEn ?? code
}

/** "YYYY-MM-DD" -> "DD/MM/YYYY" (Latin digits). */
function fmtDate(date: string): string {
  const [y, m, d] = date.split("-")
  return `${d}/${m}/${y}`
}

export function buildWhatsAppMessage(args: {
  branchName: string
  doctorName: string
  serviceName: string
  gender: Gender
  areaCodes: string[]
  date: string
  startMin: number
  customerName: string
  phone: string
  cfg: LaserConfig
}): string {
  const male = args.gender === "male"
  const clientLabel = male ? "العميل" : "العميلة"
  const wantVerb = male ? "عايز" : "عايزة"
  const areas = args.areaCodes.map((a) => areaLabel(a, args.cfg)).join("، ")
  const dayName = DAY_LABELS[weekdaySat0(args.date)]

  return [
    `*${args.branchName}*`,
    `${clientLabel}: ${args.customerName || "—"}`,
    `الرقم: ${args.phone || "—"}`,
    `الخدمة: ${args.serviceName}${areas ? " — " + areas : ""}`,
    `الدكتورة: ${args.doctorName}`,
    `${wantVerb} ميعاد: ${dayName} ${fmtDate(args.date)} — ${tLabel(args.startMin)}`,
  ].join("\n")
}

// ---- decision card presentation ----
export type DecisionTone = "request" | "notice" | "no_ticket"

export type DecisionCardCopy = {
  tone: DecisionTone
  title: string
  instruction: string
  dentolizeLabel: string // the status to set in Dentolize
  canSend: boolean
}

export function decisionCardCopy(kind: TicketKind | null, slaMinutes: number): DecisionCardCopy {
  if (kind === "request") {
    return {
      tone: "request",
      title: "طلب حجز — محتاج رد الفرع",
      instruction: `ابعت طلب للفرع واستنى الرد خلال ${formatNumber(slaMinutes)} دقايق.`,
      dentolizeLabel: "Open",
      canSend: true,
    }
  }
  if (kind === "notice") {
    return {
      tone: "notice",
      title: "إشعار للفرع",
      instruction: "احجز Confirmed على Dentolize وابعت إشعار للفرع.",
      dentolizeLabel: "Confirmed",
      canSend: true,
    }
  }
  return {
    tone: "no_ticket",
    title: "مفيش تيكت",
    instruction: "احجز Open على Dentolize. مفيش تيكت — الفرع هيأكد بنفسه.",
    dentolizeLabel: "Open",
    canSend: false,
  }
}

/** Plain-Arabic one-liner explaining why, e.g. "د. هبة Open والميعاد بكرة". */
export function decisionReasonText(
  reasonCode: string,
  args: { doctorName: string; whenLabel: string }
): string {
  const { doctorName, whenLabel } = args
  switch (reasonCode) {
    case "same_day_branch_rule":
      return `نفس اليوم — الفرع لازم يوافق الأول (${whenLabel})`
    case "doctor_confirmed":
      return `${doctorName} Confirmed — إشعار بس`
    case "open_turned_confirmed":
      return `${doctorName} Open بس بتتأكد تلقائي في اليوم ده`
    case "confirmed_turned_open":
      return `${doctorName} اتحوّلت Open بأمر الفرع`
    case "open_doctor_today_tomorrow":
      return `${doctorName} Open والميعاد ${whenLabel}`
    case "open_later_no_ticket":
      return `${doctorName} Open والميعاد ${whenLabel} — الفرع هيأكد بنفسه`
    default:
      return ""
  }
}

// ---- RPC error -> Arabic ----
const RPC_ERRORS: Record<string, string> = {
  doctor_not_found: "الدكتورة مش موجودة.",
  service_not_found: "الخدمة مش موجودة.",
  service_not_offered_in_branch: "الخدمة دي مش متاحة في الفرع ده.",
  date_in_past: "التاريخ فات — اختار يوم تاني.",
  doctor_does_not_accept_men: "الدكتورة دي بتستقبل سيدات بس.",
  branch_unavailable_on_date: "الفرع مقفول في اليوم ده.",
  doctor_unavailable_on_date: "الدكتورة مش متاحة في اليوم ده (غياب أو وقف حجز).",
  laser_areas_required: "اختار مناطق الليزر الأول.",
  no_ticket_needed: "مفيش تيكت مطلوب — احجز Open على Dentolize والفرع هيأكد.",
  not_allowed: "مش مسموح بالعملية دي.",
  ticket_not_found: "التيكت مش موجود.",
  ticket_not_answered: "التيكت لسه الفرع مردش عليه.",
  already_answered: "التيكت اترد عليه خلاص.",
  already_handled: "التيكت اتعالج خلاص.",
  ticket_already_final: "التيكت اتقفل خلاص.",
  reason_required: "لازم تكتب سبب.",
  invalid_outcome: "نتيجة غير صحيحة.",
  not_a_request: "التيكت ده مش طلب حجز.",
  not_a_notice: "التيكت ده مش إشعار.",
  counter_offer_needs_date_and_time: "الميعاد البديل لازم يكون فيه تاريخ ووقت.",
  counter_doctor_not_in_branch: "الدكتورة دي مش في الفرع.",
  status_change_only_today_or_tomorrow: "تغيير الحالة بس للنهاردة أو بكرة.",
}

export function mapRpcError(message: string | undefined | null): string {
  if (!message) return "حصل خطأ، حاول تاني."
  for (const code of Object.keys(RPC_ERRORS)) {
    if (message.includes(code)) return RPC_ERRORS[code]
  }
  return "حصل خطأ، حاول تاني."
}
