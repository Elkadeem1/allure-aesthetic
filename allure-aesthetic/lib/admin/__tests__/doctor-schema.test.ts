import { describe, it, expect } from "vitest"
import {
  validateSchedule,
  copyDay,
  weeklyScheduleSchema,
  doctorInputSchema,
  type ScheduleEntry,
} from "../doctor-schema"

const UUID = "11111111-1111-1111-1111-111111111111"

const seg = (weekday: number, start: string, end: string, kind = "all"): ScheduleEntry => ({
  weekday,
  start,
  end,
  kind: kind as ScheduleEntry["kind"],
})

describe("validateSchedule", () => {
  it("accepts a clean schedule", () => {
    expect(validateSchedule([seg(0, "10:00", "14:00"), seg(0, "14:00", "18:00", "laser")])).toBeNull()
  })

  it("rejects end before/equal start", () => {
    expect(validateSchedule([seg(1, "14:00", "10:00")])).not.toBeNull()
    expect(validateSchedule([seg(1, "10:00", "10:00")])).not.toBeNull()
  })

  it("rejects overlapping segments on the same day", () => {
    expect(validateSchedule([seg(2, "10:00", "14:00"), seg(2, "13:00", "16:00")])).not.toBeNull()
  })

  it("allows the same clock range on different days", () => {
    expect(validateSchedule([seg(0, "10:00", "14:00"), seg(1, "10:00", "14:00")])).toBeNull()
  })

  it("allows touching (non-overlapping) segments", () => {
    expect(validateSchedule([seg(3, "10:00", "12:00"), seg(3, "12:00", "15:00")])).toBeNull()
  })
})

describe("copyDay", () => {
  const entries = [seg(0, "10:00", "14:00"), seg(0, "14:00", "18:00", "laser"), seg(1, "09:00", "12:00")]

  it("copies the source day's segments onto target days, replacing them", () => {
    const out = copyDay(entries, 0, [1, 2])
    // day 0 unchanged (2), day 1 replaced by 2 copies, day 2 gets 2 copies
    expect(out.filter((e) => e.weekday === 0)).toHaveLength(2)
    expect(out.filter((e) => e.weekday === 1)).toHaveLength(2)
    expect(out.filter((e) => e.weekday === 2)).toHaveLength(2)
    expect(out.filter((e) => e.weekday === 1).every((e) => e.start === "10:00" || e.start === "14:00")).toBe(true)
  })

  it("ignores the source day if included in targets", () => {
    const out = copyDay(entries, 0, [0, 2])
    expect(out.filter((e) => e.weekday === 0)).toHaveLength(2)
    expect(out.filter((e) => e.weekday === 1)).toHaveLength(1) // untouched
  })

  it("copying an empty day clears the target days", () => {
    const out = copyDay(entries, 5, [1])
    expect(out.filter((e) => e.weekday === 1)).toHaveLength(0)
  })
})

describe("weeklyScheduleSchema", () => {
  it("fails on overlap", () => {
    const r = weeklyScheduleSchema.safeParse([seg(0, "10:00", "14:00"), seg(0, "13:00", "15:00")])
    expect(r.success).toBe(false)
  })
  it("passes a valid week", () => {
    expect(weeklyScheduleSchema.safeParse([seg(0, "10:00", "18:00")]).success).toBe(true)
  })
})

describe("doctorInputSchema", () => {
  const base = {
    branchId: UUID,
    code: "doc-1",
    displayName: "د. هبة",
    specialty: null,
    notes: null,
    personKey: null,
    alwaysOpen: false,
    acceptsMen: true,
    laserMenAllowed: true,
    menLaserAreaCodes: null,
    rejectsSmallAreasOnly: false,
    noOverlap: false,
  }
  it("accepts valid input", () => {
    expect(doctorInputSchema.safeParse(base).success).toBe(true)
  })
  it("requires a display name", () => {
    expect(doctorInputSchema.safeParse({ ...base, displayName: "  " }).success).toBe(false)
  })
  it("requires a uuid branch", () => {
    expect(doctorInputSchema.safeParse({ ...base, branchId: "nope" }).success).toBe(false)
  })
})
