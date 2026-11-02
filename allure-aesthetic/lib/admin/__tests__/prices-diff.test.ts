import { describe, it, expect } from "vitest"
import { diffPriceImport } from "../prices/diff"

const branchNames = { newcairo: "التجمع", mansoura: "المنصورة" }

describe("diffPriceImport", () => {
  it("counts new / changed / deactivated items", () => {
    const d = diffPriceImport({
      fileItems: [
        { code: "FIL-01", full_name: "A", category_code: "FIL" }, // changed
        { code: "FIL-02", full_name: "B", category_code: "FIL" }, // new
      ],
      filePrices: [
        { code: "FIL-01", branch: "newcairo", price: 600 },
        { code: "FIL-02", branch: "newcairo", price: 100 },
      ],
      dbItems: [
        { code: "FIL-01", full_name: "A", is_active: true },
        { code: "FIL-09", full_name: "Z", is_active: true }, // missing -> deactivated
      ],
      dbPrices: [{ code: "FIL-01", branch: "newcairo", price: 500 }],
      branchNames,
    })
    expect(d.counts).toEqual({ newItems: 1, changedItems: 1, deactivatedItems: 1 })
  })

  it("does not deactivate Innova (INV-) items missing from the file", () => {
    const d = diffPriceImport({
      fileItems: [{ code: "FIL-01", full_name: "A", category_code: "FIL" }],
      filePrices: [],
      dbItems: [
        { code: "FIL-01", full_name: "A", is_active: true },
        { code: "INV-003", full_name: "Innova", is_active: true },
      ],
      dbPrices: [],
      branchNames,
    })
    expect(d.counts.deactivatedItems).toBe(0)
  })

  it("flags a change above 30% as big", () => {
    const d = diffPriceImport({
      fileItems: [{ code: "FIL-01", full_name: "A", category_code: "FIL" }],
      filePrices: [{ code: "FIL-01", branch: "newcairo", price: 700 }], // +40%
      dbItems: [{ code: "FIL-01", full_name: "A", is_active: true }],
      dbPrices: [{ code: "FIL-01", branch: "newcairo", price: 500 }],
      branchNames,
    })
    expect(d.changes).toHaveLength(1)
    expect(d.changes[0]).toMatchObject({ oldPrice: 500, newPrice: 700, big: true })
    expect(Math.round(d.changes[0].pct!)).toBe(40)
  })

  it("does not flag a small change as big", () => {
    const d = diffPriceImport({
      fileItems: [{ code: "FIL-01", full_name: "A", category_code: "FIL" }],
      filePrices: [{ code: "FIL-01", branch: "newcairo", price: 550 }], // +10%
      dbItems: [{ code: "FIL-01", full_name: "A", is_active: true }],
      dbPrices: [{ code: "FIL-01", branch: "newcairo", price: 500 }],
      branchNames,
    })
    expect(d.changes[0].big).toBe(false)
  })

  it("records added (old null) and removed (new null) prices", () => {
    const d = diffPriceImport({
      fileItems: [{ code: "FIL-01", full_name: "A", category_code: "FIL" }],
      filePrices: [{ code: "FIL-01", branch: "newcairo", price: 300 }], // added here
      dbItems: [{ code: "FIL-01", full_name: "A", is_active: true }],
      dbPrices: [{ code: "FIL-01", branch: "mansoura", price: 400 }], // removed here
      branchNames,
    })
    const nc = d.changes.find((c) => c.branch === "newcairo")
    const mn = d.changes.find((c) => c.branch === "mansoura")
    expect(nc).toMatchObject({ oldPrice: null, newPrice: 300 })
    expect(mn).toMatchObject({ oldPrice: 400, newPrice: null })
  })

  it("ignores unchanged prices", () => {
    const d = diffPriceImport({
      fileItems: [{ code: "FIL-01", full_name: "A", category_code: "FIL" }],
      filePrices: [{ code: "FIL-01", branch: "newcairo", price: 500 }],
      dbItems: [{ code: "FIL-01", full_name: "A", is_active: true }],
      dbPrices: [{ code: "FIL-01", branch: "newcairo", price: 500 }],
      branchNames,
    })
    expect(d.changes).toHaveLength(0)
    expect(d.counts.changedItems).toBe(0)
  })
})
