// =====================================================================
// Date + start-time helpers built on windowsFor / evalDoctor.
//   * availableDates — which of the next N days the doctor can take this
//     service/gender/areas booking.
//   * startSlots — valid start times (step 15m) on a date for a given
//     session length, from the doctor's windows.
// =====================================================================

import type { DoctorContext, Gender, LaserConfig, Service } from "./types"
import { evalDoctor, windowsFor } from "./availability"
import { addDays } from "./time"

/** The next `count` calendar days starting from `today` (inclusive). */
export function nextDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i))
}

/** Of the next `count` days, those on which the doctor is available for this booking. */
export function availableDates(
  ctx: DoctorContext,
  args: { today: string; count: number; service: Service; gender: Gender; areas: string[] },
  cfg: LaserConfig
): string[] {
  const { today, count, service, gender, areas } = args
  return nextDays(today, count).filter(
    (date) => evalDoctor(ctx, { date, service, gender, areas }, cfg).ok
  )
}

/** Valid start times (minutes since midnight) on a date for a session of `durationMin`. */
export function startSlots(
  ctx: DoctorContext,
  args: { date: string; service: Service; durationMin: number; stepMin?: number },
  cfg: LaserConfig
): number[] {
  const { date, service, durationMin } = args
  const step = args.stepMin ?? 15
  void cfg
  const { windows } = windowsFor(ctx, { date, service })
  const slots: number[] = []
  for (const w of windows) {
    for (let t = w.from; t + durationMin <= w.to; t += step) slots.push(t)
  }
  return slots
}
