import { describe, expect, it } from "vitest"
import { evalDoctor, roomFor, windowsFor } from "../availability"
import { hm } from "../time"
import type { DoctorUpdate } from "../types"
import {
  CONSULT,
  HEBA,
  LASER,
  LASER_CONFIG,
  SAT,
  SUN,
  MON,
  WED,
  hebaCtx,
  kholoudCtx,
  mahitabCtx,
  nourhanCtx,
  olaCtx,
} from "./fixtures"

const laserArgs = (date: string, gender: "female" | "male", areas: string[]) => ({
  date,
  service: LASER,
  gender,
  areas,
})

const upd = (over: Partial<DoctorUpdate>): DoctorUpdate => ({
  id: "u",
  doctorId: HEBA.id,
  type: "off",
  dateFrom: "2026-01-01",
  dateTo: "2026-12-31",
  atTime: null,
  weekdays: [],
  segments: [],
  note: null,
  createdAt: "2026-10-01T00:00:00Z",
  ...over,
})

describe("Heba Ghonim (Tanta 1) — women only, rejects small-areas-only", () => {
  it("rejects men", () => {
    const r = evalDoctor(hebaCtx(), laserArgs(SAT, "male", ["w_face"]), LASER_CONFIG)
    expect(r.ok).toBe(false)
    expect(r.reasons).toContain("بتستقبل سيدات بس")
  })

  it("rejects a booking that is only small areas", () => {
    const r = evalDoctor(hebaCtx(), laserArgs(SAT, "female", ["w_mustache"]), LASER_CONFIG)
    expect(r.ok).toBe(false)
    expect(r.reasons.some((x) => x.includes("الأريات الصغيرة"))).toBe(true)
  })

  it("accepts a normal-area booking on a working day", () => {
    const r = evalDoctor(hebaCtx(), laserArgs(SAT, "female", ["w_face"]), LASER_CONFIG)
    expect(r.ok).toBe(true)
    expect(r.reasons).toEqual([])
  })
})

describe("Ola Gadallah (Shebin) — men laser only beard + underarm, no overlap", () => {
  it("accepts an allowed men area and flags no-overlap", () => {
    const r = evalDoctor(olaCtx(), laserArgs(WED, "male", ["m_beard"]), LASER_CONFIG)
    expect(r.ok).toBe(true)
    expect(r.notes.some((n) => n.includes("أوفر لاب"))).toBe(true)
  })

  it("rejects a men area outside beard/underarm", () => {
    const r = evalDoctor(olaCtx(), laserArgs(WED, "male", ["m_chest"]), LASER_CONFIG)
    expect(r.ok).toBe(false)
    expect(r.reasons.some((x) => x.includes("تحديد الدقن") && x.includes("الإبط"))).toBe(true)
  })
})

describe("Mahitab Sabry (Shebin) — last laser 6 PM on Saturday", () => {
  it("laser Saturday window ends at 18:00 and excludes the evening 'other' segment", () => {
    const w = windowsFor(mahitabCtx(), { date: SAT, service: LASER })
    expect(w.windows).toEqual([{ from: hm("10:00"), to: hm("18:00"), cut: null, derma: false }])
  })

  it("a non-laser service can use the 18:00-22:00 'other' segment", () => {
    const w = windowsFor(mahitabCtx(), { date: SAT, service: CONSULT })
    expect(w.windows).toEqual([{ from: hm("18:00"), to: hm("22:00"), cut: null, derma: false }])
  })
})

describe("Tanta 2 — Monday morning shift, no laser after 2 PM", () => {
  it("branch cut-off clamps the laser window to 14:00", () => {
    const w = windowsFor(nourhanCtx(), { date: MON, service: LASER })
    expect(w.windows).toEqual([{ from: hm("10:00"), to: hm("14:00"), cut: hm("14:00"), derma: false }])
    expect(w.cutoffApplied).toBe(true)
  })

  it("non-laser is not cut off", () => {
    const w = windowsFor(nourhanCtx(), { date: MON, service: CONSULT })
    expect(w.windows).toEqual([{ from: hm("10:00"), to: hm("16:00"), cut: null, derma: false }])
  })
})

describe("Kholoud Fayrouz (Kafr el-Sheikh) — Sat 10-2 laser only, 2-4 other services", () => {
  it("laser Saturday window is 10:00-14:00", () => {
    const w = windowsFor(kholoudCtx(), { date: SAT, service: LASER })
    expect(w.windows).toEqual([{ from: hm("10:00"), to: hm("14:00"), cut: null, derma: false }])
  })

  it("other-service Saturday window is 14:00-16:00", () => {
    const w = windowsFor(kholoudCtx(), { date: SAT, service: CONSULT })
    expect(w.windows).toEqual([{ from: hm("14:00"), to: hm("16:00"), cut: null, derma: false }])
  })

  it("rejects laser for men", () => {
    const r = evalDoctor(kholoudCtx(), laserArgs(SAT, "male", ["m_beard"]), LASER_CONFIG)
    expect(r.ok).toBe(false)
    expect(r.reasons).toContain("ممنوع ليزر رجالة معاها")
  })
})

// ---- migration-6 additions ----

describe("full (الحجز اكتمل) blocks booking", () => {
  it("doctor/day full -> not available", () => {
    const ctx = hebaCtx([upd({ type: "full", dateFrom: SAT, dateTo: SAT })])
    const r = evalDoctor(ctx, laserArgs(SAT, "female", ["w_face"]), LASER_CONFIG)
    expect(r.ok).toBe(false)
    expect(r.reasons.some((x) => x.includes("الحجز اكتمل"))).toBe(true)
  })

  it("whole-branch full -> not available, with the branch wording", () => {
    const ctx = hebaCtx([upd({ type: "full", doctorId: null, dateFrom: SAT, dateTo: SAT })])
    const r = evalDoctor(ctx, laserArgs(SAT, "female", ["w_face"]), LASER_CONFIG)
    expect(r.ok).toBe(false)
    expect(r.reasons.some((x) => x.includes("الفرع الحجز اكتمل"))).toBe(true)
  })
})

describe("laser_stop / booking_cutoff (at_time)", () => {
  it("laser_stop clamps only laser windows", () => {
    const ctx = hebaCtx([upd({ type: "laser_stop", atTime: "13:00", dateFrom: SAT, dateTo: SAT })])
    const laserW = windowsFor(ctx, { date: SAT, service: LASER })
    expect(laserW.windows).toEqual([{ from: hm("10:00"), to: hm("13:00"), cut: hm("13:00"), derma: false }])
    const consultW = windowsFor(ctx, { date: SAT, service: CONSULT })
    expect(consultW.windows).toEqual([{ from: hm("10:00"), to: hm("16:00"), cut: null, derma: false }])
  })

  it("booking_cutoff clamps every service", () => {
    const ctx = hebaCtx([upd({ type: "booking_cutoff", atTime: "12:00", dateFrom: SAT, dateTo: SAT })])
    const laserW = windowsFor(ctx, { date: SAT, service: LASER })
    const consultW = windowsFor(ctx, { date: SAT, service: CONSULT })
    expect(laserW.windows).toEqual([{ from: hm("10:00"), to: hm("12:00"), cut: hm("12:00"), derma: false }])
    expect(consultW.windows).toEqual([{ from: hm("10:00"), to: hm("12:00"), cut: hm("12:00"), derma: false }])
  })
})

describe("recurring updates (weekdays)", () => {
  it("an off recurring on Saturdays blocks only Saturdays", () => {
    const ctx = hebaCtx([
      upd({ type: "off", weekdays: [0], dateFrom: "2026-10-01", dateTo: "2026-12-31" }),
    ])
    const sat = evalDoctor(ctx, laserArgs(SAT, "female", ["w_face"]), LASER_CONFIG)
    expect(sat.ok).toBe(false)
    expect(sat.reasons.some((x) => x.includes("غايبة يوم السبت"))).toBe(true)

    const sun = evalDoctor(ctx, laserArgs(SUN, "female", ["w_face"]), LASER_CONFIG)
    expect(sun.ok).toBe(true)
  })
})

describe("roomFor (doctor_rooms by weekday)", () => {
  it("resolves the room title for the date's weekday", () => {
    const ctx = { ...hebaCtx(), rooms: [{ weekday: 0, title: "روم ١" }] }
    expect(roomFor(ctx, SAT)).toBe("روم ١")
    expect(roomFor(ctx, SUN)).toBeNull()
  })
})
