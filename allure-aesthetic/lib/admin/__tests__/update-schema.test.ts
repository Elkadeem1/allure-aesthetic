import { describe, it, expect } from "vitest"
import { updateInputSchema, UPDATE_TYPES, BRANCH_WIDE_TYPES } from "../update-schema"

const BRANCH = "11111111-1111-1111-1111-111111111111"
const DOCTOR = "22222222-2222-2222-2222-222222222222"

function base(over: Record<string, unknown> = {}) {
  return {
    branchId: BRANCH,
    doctorId: DOCTOR,
    type: "off",
    dateFrom: "2026-11-02",
    dateTo: "2026-11-02",
    weekdays: [],
    atTime: null,
    segments: [],
    note: null,
    ...over,
  }
}

describe("updateInputSchema", () => {
  it("accepts a simple doctor 'off' for one day", () => {
    expect(updateInputSchema.safeParse(base()).success).toBe(true)
  })

  it("rejects dateTo before dateFrom", () => {
    const r = updateInputSchema.safeParse(base({ dateFrom: "2026-11-05", dateTo: "2026-11-02" }))
    expect(r.success).toBe(false)
  })

  it("rejects branch-wide (no doctor) with a doctor-only type", () => {
    const r = updateInputSchema.safeParse(base({ doctorId: null, type: "hours", segments: [{ start: "10:00", end: "14:00", kind: "all" }] }))
    expect(r.success).toBe(false)
  })

  it("accepts branch-wide 'full'", () => {
    expect(updateInputSchema.safeParse(base({ doctorId: null, type: "full" })).success).toBe(true)
  })

  it("branch-wide allowed set is exactly off/stop/full/note", () => {
    expect([...BRANCH_WIDE_TYPES].sort()).toEqual(["full", "note", "off", "stop"])
  })

  it("requires segments for 'hours'", () => {
    expect(updateInputSchema.safeParse(base({ type: "hours", segments: [] })).success).toBe(false)
  })

  it("rejects a segment whose start >= end", () => {
    const r = updateInputSchema.safeParse(base({ type: "hours", segments: [{ start: "14:00", end: "10:00", kind: "all" }] }))
    expect(r.success).toBe(false)
  })

  it("rejects overlapping hour segments", () => {
    const r = updateInputSchema.safeParse(
      base({
        type: "hours",
        segments: [
          { start: "10:00", end: "13:00", kind: "all" },
          { start: "12:00", end: "15:00", kind: "laser" },
        ],
      })
    )
    expect(r.success).toBe(false)
  })

  it("accepts non-overlapping hour segments", () => {
    const r = updateInputSchema.safeParse(
      base({
        type: "hours",
        segments: [
          { start: "10:00", end: "12:00", kind: "other" },
          { start: "12:00", end: "15:00", kind: "laser" },
        ],
      })
    )
    expect(r.success).toBe(true)
  })

  it("requires atTime for laser_stop and booking_cutoff", () => {
    expect(updateInputSchema.safeParse(base({ type: "laser_stop", atTime: null })).success).toBe(false)
    expect(updateInputSchema.safeParse(base({ type: "booking_cutoff", atTime: "13:00" })).success).toBe(true)
  })

  it("requires note text for 'note'", () => {
    expect(updateInputSchema.safeParse(base({ type: "note", note: null })).success).toBe(false)
    expect(updateInputSchema.safeParse(base({ type: "note", note: "ابدأ ليزر 2" })).success).toBe(true)
  })

  it("accepts a recurring update with weekdays in range", () => {
    const r = updateInputSchema.safeParse(base({ dateFrom: "2026-11-01", dateTo: "2026-12-31", weekdays: [0, 2] }))
    expect(r.success).toBe(true)
  })

  it("exposes 8 selectable types (no force_open)", () => {
    expect(UPDATE_TYPES.map((t) => t.value)).not.toContain("force_open")
    expect(UPDATE_TYPES).toHaveLength(8)
  })
})
