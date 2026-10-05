// Centralized number / price / time / date formatting.
//
// Staff cross-check every figure against Dentolize, which renders Latin (0-9)
// digits. So we force Latin numerals everywhere via the "ar-EG-u-nu-latn"
// locale (Egyptian Arabic formatting conventions, Latin number system) rather
// than the default "ar-EG", which produces Arabic-Indic digits (٠١٢٣…).
// Use these helpers for any number shown in the UI — never call toLocaleString
// with a bare "ar-EG" locale.

const LATIN_LOCALE = "ar-EG-u-nu-latn"

/** Format a number with Latin digits and locale grouping (e.g. 1,500). */
export function formatNumber(n: number): string {
  return n.toLocaleString(LATIN_LOCALE)
}

/** Format an EGP price, e.g. "1,500 ج". */
export function formatEgp(price: number): string {
  return `${formatNumber(price)} ج`
}

/** Format a "HH:MM" time string as 12-hour with Arabic ص/م and Latin digits. */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number)
  const ampm = h >= 12 ? "م" : "ص"
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`
}

/** Format a date as day/month with Latin digits, e.g. "5/10". */
export function formatDayMonth(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`
}
