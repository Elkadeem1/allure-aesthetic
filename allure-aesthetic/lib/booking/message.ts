// Booking-side copy helpers: Egyptian phone validation, the WhatsApp fallback
// message (MVP style), and RPC error -> Arabic.

import { DAY_LABELS, tLabel, weekdaySat0 } from "@/lib/engine"
import type { Gender, LaserConfig } from "@/lib/engine"

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

// ---- RPC error -> Arabic ----
const RPC_ERRORS: Record<string, string> = {
  doctor_not_found: "الدكتورة مش موجودة.",
  service_not_found: "الخدمة مش موجودة.",
  service_not_offered_in_branch: "الخدمة دي مش متاحة في الفرع ده.",
  // migration-6 create_ticket guards (Innova-only, today/tomorrow, full).
  tickets_not_enabled_for_branch: "الفرع ده مابيتعملوش تيكتات — التيكتات لإينوفا بس.",
  ticket_only_today_tomorrow: "التيكت بيتبعت للنهاردة أو بكرة بس.",
  fully_booked: "الحجز اكتمل في اليوم ده — أجّل أو اختار يوم تاني.",
  date_in_past: "التاريخ فات — اختار يوم تاني.",
  doctor_does_not_accept_men: "الدكتورة دي بتستقبل سيدات بس.",
  branch_unavailable_on_date: "الفرع مقفول في اليوم ده.",
  doctor_unavailable_on_date: "الدكتورة مش متاحة في اليوم ده (غياب أو وقف حجز).",
  laser_areas_required: "اختار مناطق الليزر الأول.",
  no_ticket_needed: "مفيش تيكت مطلوب للفرع ده — اتبع الخطوات واضغط «تم الحجز».",
  // branch_respond guards.
  not_a_request: "التيكت ده إشعار مش طلب.",
  invalid_response: "رد غير صحيح.",
  offered_needs_time: "لازم وقت مع العرض.",
  not_allowed: "مش مسموح بالعملية دي.",
  ticket_not_found: "التيكت مش موجود.",
  ticket_not_answered: "التيكت لسه الفرع مردش عليه.",
  already_answered: "التيكت اترد عليه خلاص.",
  ticket_already_final: "التيكت اتقفل خلاص.",
  reason_required: "لازم تكتب سبب.",
  invalid_outcome: "نتيجة غير صحيحة.",
}

export function mapRpcError(message: string | undefined | null): string {
  if (!message) return "حصل خطأ، حاول تاني."
  for (const code of Object.keys(RPC_ERRORS)) {
    if (message.includes(code)) return RPC_ERRORS[code]
  }
  return "حصل خطأ، حاول تاني."
}
