import { z } from "zod"

// ---------------------------------------------------------------------------
// Branch edit / rooms / branch-laser-cutoff schemas. Shared by the admin
// branch page, the save server actions, and Vitest.
// ---------------------------------------------------------------------------

const TIME_RE = /^\d{2}:\d{2}$/

export const branchInputSchema = z.object({
  branchId: z.string().uuid(),
  nameAr: z.string().trim().min(1, "الاسم مطلوب").max(120),
  address: z.string().trim().max(400).nullable().default(null),
  paymentMethods: z.array(z.string().trim().min(1)).default([]),
  managers: z.array(z.string().trim().min(1)).default([]),
  bookingRules: z.array(z.string().trim().min(1)).default([]),
  hasTickets: z.boolean().default(false),
  logoUrl: z.string().trim().max(400).nullable().default(null),
  isActive: z.boolean().default(true),
})

export type BranchInput = z.infer<typeof branchInputSchema>

export const roomSchema = z.object({
  id: z.string().uuid().nullable().default(null), // null = new room
  code: z.string().trim().min(1, "الكود مطلوب").max(32),
  title: z.string().trim().min(1, "الاسم مطلوب").max(120),
  sort: z.number().int().min(0),
  isActive: z.boolean().default(true),
})

export const saveRoomsSchema = z
  .object({
    branchId: z.string().uuid(),
    rooms: z.array(roomSchema).default([]),
  })
  .superRefine((v, ctx) => {
    const codes = v.rooms.map((r) => r.code.trim().toLowerCase())
    if (new Set(codes).size !== codes.length) {
      ctx.addIssue({ code: "custom", message: "فيه كود غرفة مكرر." })
    }
  })

export const branchCutoffSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    shiftStartsBefore: z.string().regex(TIME_RE, "وقت غير صحيح"),
    cutoff: z.string().regex(TIME_RE, "وقت غير صحيح"),
  })

export const saveBranchCutoffsSchema = z
  .object({
    branchId: z.string().uuid(),
    cutoffs: z.array(branchCutoffSchema).default([]),
  })
  .superRefine((v, ctx) => {
    const days = v.cutoffs.map((c) => c.weekday)
    if (new Set(days).size !== days.length) {
      ctx.addIssue({ code: "custom", message: "فيه يوم متكرر في كت أوف الليزر." })
    }
  })
