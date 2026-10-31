import { describe, expect, it } from "vitest"
import { decide, type DecideArgs } from "../decision"
import type { Doctor, DoctorUpdate } from "../types"
import { EMAN, HEBA, NOURHAN, OLA, SAT, SUN, MON, THU } from "./fixtures"

const openSlot = (doctorId: string, date: string, note: string | null = null): DoctorUpdate => ({
  id: "u-open-slot",
  doctorId,
  type: "open_slot",
  dateFrom: date,
  dateTo: date,
  atTime: null,
  weekdays: [],
  segments: [],
  note,
  createdAt: "2026-10-01T00:00:00Z",
})

const run = (branchCode: string, doctor: Doctor, over: Partial<DecideArgs> = {}) =>
  decide({
    branchCode,
    hasTickets: branchCode === "innova",
    doctor,
    serviceCode: "laser",
    date: SAT,
    today: SAT,
    updates: [],
    ...over,
  })

describe("decide — Dentolize status + per-branch guidance (HTML decide port)", () => {
  it("Tanta 1 Saturday: an Open doctor is confirmed by us", () => {
    const d = run("tanta1", HEBA, { date: SAT, today: SAT })
    expect(d.status).toBe("Confirmed")
    expect(d.statusNote).toBe("السبت بنأكده إحنا")
    expect(d.steps[0]).toContain("احجز في السيستم بحالة Confirmed")
    expect(d.steps[0]).toContain("السبت بنأكده")
    expect(d.ticket).toBe("none")
  })

  it("Tanta 1 non-Saturday Open doctor: book Open and wait for the branch", () => {
    const d = run("tanta1", HEBA, { date: SUN, today: SUN })
    expect(d.status).toBe("Open")
    expect(d.steps).toContain("احجز في السيستم بحالة Open")
    expect(d.steps).toContain("استنى الفرع يأكد المعاد")
  })

  it("Tanta 2 same day: send to the group and wait for the reply", () => {
    const d = run("tanta2", NOURHAN, { date: MON, today: MON })
    expect(d.statusNote).toBe("بعد موافقة الفرع على الجروب")
    expect(d.steps[0]).toContain("ابعت بيانات الحالة على الجروب")
  })

  it("New Cairo: always warns that times/prices differ and update often", () => {
    const d = run("newcairo", NOURHAN, { date: MON, today: MON })
    expect(d.warns.some((w) => w.includes("القاهرة الجديدة"))).toBe(true)
    expect(d.info).toContain("كل الدكاترة بيشتغلوا للرجالة عادي.")
    expect(d.status).toBe("Confirmed")
  })

  it("New Cairo later date: book Open, call-center confirms", () => {
    const d = run("newcairo", NOURHAN, { date: THU, today: MON })
    expect(d.status).toBe("Open")
    expect(d.steps.some((s) => s.includes("Open"))).toBe(true)
  })

  it("Shebin: no-overlap warnings, incl. the per-doctor one", () => {
    const d = run("shebin", OLA, { date: SAT, today: SAT })
    expect(d.warns.some((w) => w.includes("أوفر لاب"))).toBe(true)
    expect(d.warns.some((w) => w.includes("بتاخد وقتها في السيشن"))).toBe(true)
  })

  it("Innova: always_open doctor books Open and an innova ticket is in play", () => {
    const d = run("innova", EMAN, { date: SAT, today: SAT })
    expect(d.status).toBe("Open")
    expect(d.ticket).toBe("innova_ticket")
    expect(d.info.some((i) => i.includes("في إينوفا بنحجز بحالة Open"))).toBe(true)
  })

  it("Innova consultation: shows the Re Cons note", () => {
    const d = run("innova", EMAN, { date: SAT, today: SAT, serviceCode: "consult" })
    expect(d.info.some((i) => i.includes("Re Cons"))).toBe(true)
  })

  it("Innova later date: no ticket", () => {
    const d = run("innova", EMAN, { date: THU, today: MON })
    expect(d.ticket).toBe("none")
  })

  it("open_slot update turns an Open booking into Confirmed", () => {
    const d = run("innova", EMAN, {
      date: SAT,
      today: SAT,
      updates: [openSlot(EMAN.id, SAT)],
    })
    expect(d.status).toBe("Confirmed")
    expect(d.info.some((i) => i.includes("الحجز اتحول لـ Confirmed"))).toBe(true)
  })
})
