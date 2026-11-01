import { z } from "zod"
import type { UpdateType, ShiftKind } from "@/lib/types/database.types"

// ---------------------------------------------------------------------------
// Update types offered in the admin "add update" dialog, with their metadata.
// Mirrors the HTML UP_TYPES and the DB `update_type` enum / sync trigger.
// ---------------------------------------------------------------------------
export type UpdateTypeMeta = {
  value: Exclude<UpdateType, "force_open">
  label: string // Egyptian Arabic
  branchWide: boolean // may target the whole branch (doctor_id null)
  needsSegments?: boolean // 'hours'
  needsAtTime?: boolean // laser_stop / booking_cutoff
  needsNote?: boolean // 'note'
}

export const UPDATE_TYPES: UpdateTypeMeta[] = [
  { value: "off", label: "غايبة", branchWide: true },
  { value: "stop", label: "وقف حجز", branchWide: true },
  { value: "hours", label: "ساعات مختلفة", branchWide: false, needsSegments: true },
  { value: "open_slot", label: "الدور فاضي — احجزي Confirmed", branchWide: false },
  { value: "laser_stop", label: "وقف الليزر من ساعة", branchWide: false, needsAtTime: true },
  { value: "booking_cutoff", label: "وقف الحجز بعد ساعة", branchWide: false, needsAtTime: true },
  { value: "full", label: "الحجز اكتمل", branchWide: true },
  { value: "note", label: "ملاحظة", branchWide: true, needsNote: true },
]

export const UPDATE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  UPDATE_TYPES.map((t) => [t.value, t.label])
)

export const BRANCH_WIDE_TYPES = UPDATE_TYPES.filter((t) => t.branchWide).map((t) => t.value)

export const SHIFT_KINDS: { value: ShiftKind; label: string }[] = [
  { value: "laser", label: "ليزر" },
  { value: "other", label: "باقي الخدمات" },
  { value: "all", label: "كل الخدمات" },
]

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

const segmentSchema = z.object({
  start: z.string().regex(TIME_RE, "وقت غير صحيح"),
  end: z.string().regex(TIME_RE, "وقت غير صحيح"),
  kind: z.enum(["all", "laser", "other", "derma"]),
})

// Shape sent to the server action. The "when" (single / range / recurring)
// is already resolved by the dialog into dateFrom/dateTo (+ weekdays).
export const updateInputSchema = z
  .object({
    branchId: z.string().uuid("اختار الفرع"),
    doctorId: z.string().uuid().nullable(),
    type: z.enum([
      "off",
      "stop",
      "hours",
      "open_slot",
      "laser_stop",
      "booking_cutoff",
      "full",
      "note",
    ]),
    dateFrom: z.string().regex(DATE_RE, "اختار التاريخ"),
    dateTo: z.string().regex(DATE_RE, "اختار التاريخ"),
    weekdays: z.array(z.number().int().min(0).max(6)).default([]),
    atTime: z.string().regex(TIME_RE).nullable().default(null),
    segments: z.array(segmentSchema).default([]),
    note: z.string().trim().max(500).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (v.dateTo < v.dateFrom) {
      ctx.addIssue({ code: "custom", path: ["dateTo"], message: "تاريخ النهاية لازم يكون بعد البداية." })
    }

    // Branch-wide (no doctor) is limited to off / stop / full / note.
    if (v.doctorId === null && !BRANCH_WIDE_TYPES.includes(v.type as never)) {
      ctx.addIssue({
        code: "custom",
        path: ["type"],
        message: "التحديث على الفرع كله لازم يكون: غياب، وقف حجز، الحجز اكتمل، أو ملاحظة.",
      })
    }

    if (v.type === "hours") {
      if (v.segments.length === 0) {
        ctx.addIssue({ code: "custom", path: ["segments"], message: "لازم تحدد فترة واحدة على الأقل." })
      }
      v.segments.forEach((s, i) => {
        if (s.start >= s.end) {
          ctx.addIssue({ code: "custom", path: ["segments", i, "end"], message: "البداية لازم تكون قبل النهاية." })
        }
      })
      // overlap check
      for (let i = 0; i < v.segments.length; i++) {
        for (let j = i + 1; j < v.segments.length; j++) {
          if (v.segments[i].start < v.segments[j].end && v.segments[j].start < v.segments[i].end) {
            ctx.addIssue({ code: "custom", path: ["segments"], message: "في فترات متداخلة — راجعها." })
          }
        }
      }
    }

    if ((v.type === "laser_stop" || v.type === "booking_cutoff") && !v.atTime) {
      ctx.addIssue({ code: "custom", path: ["atTime"], message: "لازم تحدد الساعة." })
    }

    if (v.type === "note" && !v.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "لازم تكتب الملاحظة." })
    }
  })

export type UpdateInput = z.infer<typeof updateInputSchema>
