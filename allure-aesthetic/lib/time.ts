// =====================================================================
// Africa/Cairo date helpers. THE single source for "today" in the app.
//
// The bug this prevents: comparing a Cairo wall-clock string like
// "2026-10-06T00:00:00" against a UTC `timestamptz` column makes Postgres
// read it as UTC midnight. Cairo midnight is 21:00/22:00 UTC the *previous*
// day, so tickets created between ~22:00 UTC and 00:00 UTC (01:00–02:00 Cairo)
// fall outside the window and vanish from "today".
//
// cairoDayRange() returns the Cairo day's bounds as real UTC instants, so
// every "today" query compares apples to apples.
// =====================================================================

import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

export const CAIRO_TZ = "Africa/Cairo"

const pad = (n: number) => String(n).padStart(2, "0")

/** The Cairo calendar date ("YYYY-MM-DD") of an instant (default: now). */
export function cairoDateOf(instant: Date = new Date()): string {
  return formatInTimeZone(instant, CAIRO_TZ, "yyyy-MM-dd")
}

/** Today's Cairo date, "YYYY-MM-DD". */
export function cairoToday(): string {
  return cairoDateOf()
}

function nextCalendarDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export type CairoDayRange = {
  /** The Cairo date, "YYYY-MM-DD". */
  dateStr: string
  /** UTC ISO instant of Cairo 00:00 that day (inclusive). */
  startUtc: string
  /** UTC ISO instant of the next Cairo 00:00 (exclusive). */
  endUtc: string
}

/**
 * Start/end of a Cairo day as UTC ISO timestamps. Pass a "YYYY-MM-DD" (Cairo
 * date) or a Date instant; defaults to the current Cairo day. The end is the
 * next Cairo midnight computed independently, so DST transitions are handled.
 */
export function cairoDayRange(date?: string | Date): CairoDayRange {
  const dateStr = typeof date === "string" ? date : cairoDateOf(date ?? new Date())
  const next = nextCalendarDay(dateStr)
  const startUtc = fromZonedTime(`${dateStr}T00:00:00`, CAIRO_TZ).toISOString()
  const endUtc = fromZonedTime(`${next}T00:00:00`, CAIRO_TZ).toISOString()
  return { dateStr, startUtc, endUtc }
}

/** Current Cairo weekday, Saturday = 0 … Friday = 6 (matches the engine). */
export function cairoWeekdaySat0(instant: Date = new Date()): number {
  const iso = Number(formatInTimeZone(instant, CAIRO_TZ, "i")) // 1=Mon … 7=Sun
  return (iso + 1) % 7
}

/** Current Cairo wall-clock in minutes since midnight. */
export function cairoNowMinutes(instant: Date = new Date()): number {
  const [h, m] = formatInTimeZone(instant, CAIRO_TZ, "HH:mm").split(":")
  return Number(h) * 60 + Number(m)
}
