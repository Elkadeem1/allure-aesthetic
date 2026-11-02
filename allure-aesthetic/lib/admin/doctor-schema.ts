import { z } from "zod"

// ---------------------------------------------------------------------------
// Shared doctor / weekly-schedule schemas + pure helpers.
// Used by the admin doctor page, the save server action, and Vitest.
// Weekday numbering: Saturday = 0 … Friday = 6 (same as the DB).
// ---------------------------------------------------------------------------

export const DAY_LABELS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]

export const SHIFT_KINDS = [
  { value: "all", label: "كل الخدمات" },
  { value: "laser", label: "ليزر" },
  { value: "other", label: "باقي الخدمات" },
  { value: "derma", label: "جلدية" },
] as const

export type ShiftKindValue = (typeof SHIFT_KINDS)[number]["value"]

const TIME_RE = /^\d{2}:\d{2}$/

/** "HH:MM" -> minutes since midnight. */
export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + (m || 0)
}

export type ScheduleEntry = {
  weekday: number
  start: string // "HH:MM"
  end: string
  kind: ShiftKindValue
}

/**
 * Validate a flat list of schedule segments (across all 7 days).
 * Returns a clear Arabic error, or null when valid. Rules:
 *   - start/end present and well-formed, end strictly after start
 *   - no two segments on the SAME weekday overlap
 */
export function validateSchedule(entries: ScheduleEntry[]): string | null {
  for (const e of entries) {
    if (!TIME_RE.test(e.start) || !TIME_RE.test(e.end)) {
      return `فيه فترة في ${DAY_LABELS[e.weekday] ?? "يوم"} من غير وقت كامل.`
    }
    if (toMinutes(e.start) >= toMinutes(e.end)) {
      return `في ${DAY_LABELS[e.weekday]}: وقت البداية لازم يكون قبل النهاية.`
    }
  }
  // Overlap check, per weekday.
  for (let day = 0; day <= 6; day++) {
    const segs = entries
      .filter((e) => e.weekday === day)
      .map((e) => ({ from: toMinutes(e.start), to: toMinutes(e.end) }))
      .sort((a, b) => a.from - b.from)
    for (let i = 1; i < segs.length; i++) {
      if (segs[i].from < segs[i - 1].to) {
        return `في ${DAY_LABELS[day]}: فيه فترات متداخلة — راجعها.`
      }
    }
  }
  return null
}

/**
 * Copy one day's segments onto other days (replacing whatever those days had).
 * Pure: returns a new entries array. Used by "انسخ اليوم ده لأيام تانية".
 */
export function copyDay(
  entries: ScheduleEntry[],
  fromWeekday: number,
  toWeekdays: number[]
): ScheduleEntry[] {
  const targets = new Set(toWeekdays.filter((d) => d !== fromWeekday))
  const source = entries.filter((e) => e.weekday === fromWeekday)
  const kept = entries.filter((e) => !targets.has(e.weekday))
  const copies = [...targets].flatMap((day) =>
    source.map((s) => ({ ...s, weekday: day }))
  )
  return [...kept, ...copies]
}

// --- Zod (boundary validation in the server action) ---

const scheduleEntrySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start: z.string().regex(TIME_RE, "وقت غير صحيح"),
  end: z.string().regex(TIME_RE, "وقت غير صحيح"),
  kind: z.enum(["all", "laser", "other", "derma"]),
})

export const weeklyScheduleSchema = z
  .array(scheduleEntrySchema)
  .superRefine((entries, ctx) => {
    const err = validateSchedule(entries)
    if (err) ctx.addIssue({ code: "custom", message: err })
  })

export const roomAssignmentSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  roomId: z.string().uuid(),
})

export const saveScheduleSchema = z.object({
  doctorId: z.string().uuid(),
  entries: weeklyScheduleSchema,
  rooms: z.array(roomAssignmentSchema).default([]),
})

export const doctorInputSchema = z.object({
  branchId: z.string().uuid("اختار الفرع"),
  code: z.string().trim().min(1, "الكود مطلوب").max(64),
  displayName: z.string().trim().min(1, "الاسم مطلوب").max(120),
  specialty: z.string().trim().max(200).nullable().default(null),
  notes: z.string().trim().max(2000).nullable().default(null),
  personKey: z.string().trim().max(64).nullable().default(null),
  alwaysOpen: z.boolean().default(false),
  acceptsMen: z.boolean().default(true),
  laserMenAllowed: z.boolean().default(true),
  // null / empty = all men areas allowed
  menLaserAreaCodes: z.array(z.string()).nullable().default(null),
  rejectsSmallAreasOnly: z.boolean().default(false),
  noOverlap: z.boolean().default(false),
})

export type DoctorInput = z.infer<typeof doctorInputSchema>

export const laserCutoffSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  cutoff: z.string().regex(TIME_RE, "وقت غير صحيح"),
})

export const saveLaserCutoffsSchema = z.object({
  doctorId: z.string().uuid(),
  cutoffs: z.array(laserCutoffSchema).default([]),
})
