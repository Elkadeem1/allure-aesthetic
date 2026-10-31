// Display-only helpers for the /dashboard schedule (week table, day timeline,
// today strip, updates banner). NO engine/data changes — these reconstruct a
// per-doctor/day picture from the already-loaded DoctorData + DoctorUpdate,
// mirroring dayInfo / segLabel / ruleTags / upsList in the MVP HTML.

import { addDays, hm, tLabel, weekdaySat0 } from "@/lib/engine"
import type { DoctorData, DoctorUpdate } from "./types"

export { addDays, weekdaySat0 }

export const DAY_LABELS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]

export type Kind = "all" | "laser" | "other" | "derma"

// Dot colour + label per shift kind (all=rose, laser=gold, other=sage, derma=grey).
export const KIND_META: Record<string, { dot: string; label: string }> = {
  all: { dot: "var(--rose)", label: "" },
  laser: { dot: "var(--gold)", label: "ليزر" },
  other: { dot: "var(--sage)", label: "باقي الخدمات" },
  derma: { dot: "var(--status-notice)", label: "جلدية" },
}

export const kindMeta = (kind: string) => KIND_META[kind] ?? KIND_META.all

export type Seg = { from: number; to: number; kind: string }

/** "10 ص" / "2:30 م" for a minutes-since-midnight value. */
export const timeLabel = (min: number) => tLabel(min)

/** "10 ص – 2 م ليزر" for one segment. */
export function segLabel(seg: Seg): string {
  const k = kindMeta(seg.kind).label
  return `${tLabel(seg.from)} – ${tLabel(seg.to)}${k ? " " + k : ""}`
}

/** The 7 Cairo dates (Saturday first) of the week that contains `anchor`,
 *  shifted by `weekOffset` whole weeks. */
export function weekDates(anchor: string, weekOffset = 0): string[] {
  const saturday = addDays(anchor, -weekdaySat0(anchor) + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => addDays(saturday, i))
}

export function appliesOn(u: DoctorUpdate, dateStr: string): boolean {
  if (u.dateFrom > dateStr || dateStr > u.dateTo) return false
  if (u.weekdays.length > 0) return u.weekdays.includes(weekdaySat0(dateStr))
  return true
}

export type OffKind = "off" | "stop" | "full"
export const OFF_LABEL: Record<string, string> = {
  off: "غايبة",
  stop: "وقف حجز",
  full: "اكتمل",
}

export type DayInfo = {
  off: { type: string; note: string | null } | null // غايبة / وقف حجز / اكتمل
  hours: DoctorUpdate | null // ساعات مختلفة (replaces the fixed schedule)
  overridden: boolean
  segs: Seg[]
  cutoff: DoctorUpdate | null // booking_cutoff (at_time)
  laserStop: DoctorUpdate | null // laser_stop (at_time)
}

/** What a doctor's `dateStr` looks like: block / hours / segments + cut-offs. */
export function dayInfo(doctor: DoctorData, dateStr: string, updates: DoctorUpdate[]): DayInfo {
  const active = updates.filter(
    (u) => (u.doctorId === doctor.id || u.doctorId === null) && appliesOn(u, dateStr)
  )
  const cutoff = active.find((u) => u.type === "booking_cutoff" && u.atTime) ?? null
  const laserStop = active.find((u) => u.type === "laser_stop" && u.atTime) ?? null
  const block = active.find((u) => u.type === "off" || u.type === "stop" || u.type === "full")
  if (block) {
    return { off: { type: block.type, note: block.note }, hours: null, overridden: true, segs: [], cutoff, laserStop }
  }
  const hours = active.find((u) => u.type === "hours" && u.segments.length > 0) ?? null
  const weekday = weekdaySat0(dateStr)
  const segs: Seg[] = hours
    ? hours.segments.map((s) => ({ from: hm(s.start), to: hm(s.end), kind: s.kind ?? "all" }))
    : doctor.schedules.filter((s) => s.weekday === weekday).map((s) => ({ from: hm(s.startTime), to: hm(s.endTime), kind: s.kind }))
  segs.sort((a, b) => a.from - b.from)
  return { off: null, hours, overridden: !!hours, segs, cutoff, laserStop }
}

export type RuleTag = { label: string; cls: "rose" | "gold" | "sage" | "grey"; tip?: string }

/** Small tags shown in the doctor cell (women-only, no men-laser, …). */
export function ruleTags(d: DoctorData): RuleTag[] {
  const tags: RuleTag[] = []
  if (!d.acceptsMen) tags.push({ label: "سيدات بس", cls: "rose" })
  else if (!d.laserMenAllowed) tags.push({ label: "ممنوع ليزر رجالة", cls: "gold" })
  if (d.menLaserAreaCodes && d.menLaserAreaCodes.length > 0) {
    tags.push({ label: "ليزر رجالة: مناطق محددة", cls: "gold" })
  }
  if (d.rejectsSmallAreasOnly) {
    tags.push({ label: "مش بتعمل أريات صغيرة", cls: "grey", tip: "موستاش / دقن / أندر أرم بس — بتتحوّل على غيرها" })
  }
  if (d.noOverlap) tags.push({ label: "مفيش أوفر لاب", cls: "grey" })
  return tags
}

export type BannerRow = { id: string; sortKey: string; text: string; type: string }

const UP_LABEL: Record<string, string> = {
  off: "غايبة",
  stop: "وقف حجز",
  full: "الحجز اكتمل",
  hours: "ساعات مختلفة",
  open_slot: "الدور فاضي",
  force_open: "حجز مفتوح",
  note: "ملاحظة",
  laser_stop: "وقف ليزر",
  booking_cutoff: "وقف الحجز",
}

/** One row per update active anytime in the next `days` days (banner source). */
export function upsList(
  updates: DoctorUpdate[],
  doctorName: (id: string | null) => string,
  todayStr: string,
  days = 7
): BannerRow[] {
  const dates = Array.from({ length: days }, (_, i) => addDays(todayStr, i))
  const rows: BannerRow[] = []
  for (const u of updates) {
    const hit = dates.find((d) => appliesOn(u, d))
    if (!hit) continue
    const when = u.weekdays.length > 0
      ? "كل " + u.weekdays.map((w) => DAY_LABELS[w]).join(" و")
      : hit === todayStr
        ? "النهاردة"
        : hit === addDays(todayStr, 1)
          ? "بكرة"
          : `${DAY_LABELS[weekdaySat0(hit)]} ${Number(hit.slice(8))}/${Number(hit.slice(5, 7))}`
    const time = u.atTime ? ` (${tLabel(hm(u.atTime))})` : ""
    const label = UP_LABEL[u.type] ?? u.type
    const note = u.note ? ` — ${u.note}` : ""
    rows.push({
      id: u.id,
      sortKey: (u.weekdays.length > 0 ? todayStr : hit) + u.id,
      type: u.type,
      text: `${when}: ${label}${time} — ${doctorName(u.doctorId)}${note}`,
    })
  }
  return rows.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
}
