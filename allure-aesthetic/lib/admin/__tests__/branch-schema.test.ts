import { describe, it, expect } from "vitest"
import { branchInputSchema, saveRoomsSchema, saveBranchCutoffsSchema } from "../branch-schema"

const UUID = "11111111-1111-1111-1111-111111111111"
const UUID2 = "22222222-2222-2222-2222-222222222222"

describe("branchInputSchema", () => {
  const base = {
    branchId: UUID,
    nameAr: "التجمع",
    address: null,
    paymentMethods: ["كاش"],
    managers: ["أحمد"],
    bookingRules: ["اكد الفرع الأول"],
    hasTickets: false,
    logoUrl: null,
    isActive: true,
  }
  it("accepts valid input", () => {
    expect(branchInputSchema.safeParse(base).success).toBe(true)
  })
  it("requires a name", () => {
    expect(branchInputSchema.safeParse({ ...base, nameAr: " " }).success).toBe(false)
  })
})

describe("saveRoomsSchema", () => {
  it("accepts unique room codes", () => {
    const r = saveRoomsSchema.safeParse({
      branchId: UUID,
      rooms: [
        { id: null, code: "r1", title: "روم 1", sort: 0, isActive: true },
        { id: UUID2, code: "r2", title: "روم 2", sort: 1, isActive: false },
      ],
    })
    expect(r.success).toBe(true)
  })
  it("rejects duplicate room codes", () => {
    const r = saveRoomsSchema.safeParse({
      branchId: UUID,
      rooms: [
        { id: null, code: "r1", title: "A", sort: 0, isActive: true },
        { id: null, code: "R1", title: "B", sort: 1, isActive: true },
      ],
    })
    expect(r.success).toBe(false)
  })
  it("rejects a room with an empty title", () => {
    const r = saveRoomsSchema.safeParse({
      branchId: UUID,
      rooms: [{ id: null, code: "r1", title: "", sort: 0, isActive: true }],
    })
    expect(r.success).toBe(false)
  })
})

describe("saveBranchCutoffsSchema", () => {
  it("accepts one cutoff per weekday", () => {
    const r = saveBranchCutoffsSchema.safeParse({
      branchId: UUID,
      cutoffs: [
        { weekday: 2, shiftStartsBefore: "16:00", cutoff: "14:00" },
        { weekday: 3, shiftStartsBefore: "16:00", cutoff: "14:00" },
      ],
    })
    expect(r.success).toBe(true)
  })
  it("rejects a repeated weekday", () => {
    const r = saveBranchCutoffsSchema.safeParse({
      branchId: UUID,
      cutoffs: [
        { weekday: 2, shiftStartsBefore: "16:00", cutoff: "14:00" },
        { weekday: 2, shiftStartsBefore: "15:00", cutoff: "13:00" },
      ],
    })
    expect(r.success).toBe(false)
  })
})
