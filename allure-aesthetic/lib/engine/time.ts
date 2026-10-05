// =====================================================================
// Date / time helpers. Dates are "YYYY-MM-DD", times "HH:MM".
//
// Weekday numbering follows the MVP and the SQL weekday_sat0():
//   Saturday = 0 … Friday = 6.
// Dates are parsed as UTC midnight so arithmetic never shifts across a
// day boundary due to the host timezone — "today" (Africa/Cairo) is
// resolved by the caller and passed in as a string.
// =====================================================================

const pad = (n: number) => String(n).padStart(2, "0")

/** Minutes since midnight for an "HH:MM" string. */
export function hm(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + (m || 0)
}

/** "HH:MM" clock label (24-hour) for minutes since midnight. */
export function hhmm(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

/** 12-hour Arabic label (ص/م), Latin digits, e.g. 840 -> "2:00 م". */
export function tLabel(min: number): string {
  let h = Math.floor(min / 60)
  const m = min % 60
  const ap = h >= 12 ? "م" : "ص"
  h = h % 12
  if (h === 0) h = 12
  return h + (m ? ":" + pad(m) : "") + " " + ap
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setUTCDate(d.getUTCDate() + n)
  return toDateStr(d)
}

/** Whole-day difference a - b. */
export function dayDiff(a: string, b: string): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000)
}

/** Saturday = 0 … Friday = 6. */
export function weekdaySat0(s: string): number {
  return (parseDate(s).getUTCDay() + 1) % 7
}

export const DAY_LABELS = [
  "السبت",
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
]
