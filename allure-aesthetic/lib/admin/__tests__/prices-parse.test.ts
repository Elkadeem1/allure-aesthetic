import { describe, it, expect } from "vitest"
import ExcelJS from "exceljs"
import { parseWorkbook } from "../prices/excel.mjs"

// Column layout mirrors docs/data/price-list.xlsx (see excel.mjs).
const CAT_HEADER = ["code", "name_ar", "name_en"]
const ITEM_HEADER = ["كود", "القسم", "", "المجموعة", "النوع", "الوحدة", "الاسم", "نوع البند", "", "", "متاح", "ملاحظات"]

function item(code: string, categoryAr: string, fullName = "بند") {
  // positions: 1 code, 2 category_ar, 4 group, 5 variant, 6 unit, 7 full_name, 8 type, 11 avail, 12 notes
  return [code, categoryAr, "", "مجموعة", "نوع", "وحدة", fullName, "خدمة", "", "", "كل الفروع", ""]
}

function buildWb(opts: {
  cats?: string[][]
  items?: unknown[][]
  priceHeader?: unknown[]
  priceRows?: unknown[][]
  skipSheet?: string
}) {
  const wb = new ExcelJS.Workbook()
  if (opts.skipSheet !== "الأقسام") {
    const cs = wb.addWorksheet("الأقسام")
    cs.addRow(CAT_HEADER)
    ;(opts.cats ?? [["FIL", "فيلر", "Filler"]]).forEach((r) => cs.addRow(r))
  }
  if (opts.skipSheet !== "قائمة الأسعار") {
    const is = wb.addWorksheet("قائمة الأسعار")
    is.addRow(ITEM_HEADER)
    ;(opts.items ?? [item("FIL-01", "فيلر")]).forEach((r) => is.addRow(r))
  }
  if (opts.skipSheet !== "الأسعار حسب الفرع") {
    const ps = wb.addWorksheet("الأسعار حسب الفرع")
    ps.addRow(opts.priceHeader ?? ["كود", "التجمع الخامس", "المنصورة"])
    ;(opts.priceRows ?? [["FIL-01", 500, 450]]).forEach((r) => ps.addRow(r))
  }
  return wb
}

describe("parseWorkbook — good file", () => {
  it("parses categories, items and per-branch prices with no errors", () => {
    const r = parseWorkbook(buildWb({}))
    expect(r.errors).toEqual([])
    expect(r.categories).toHaveLength(1)
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({ code: "FIL-01", category_code: "FIL" })
    expect(r.branchPrices).toEqual(
      expect.arrayContaining([
        { code: "FIL-01", branch: "newcairo", price: 500 },
        { code: "FIL-01", branch: "mansoura", price: 450 },
      ])
    )
  })

  it("treats an empty price cell as 'not available' (no row)", () => {
    const r = parseWorkbook(buildWb({ priceRows: [["FIL-01", 500, ""]] }))
    expect(r.errors).toEqual([])
    expect(r.branchPrices.some((p) => p.branch === "mansoura")).toBe(false)
    expect(r.branchPrices.some((p) => p.branch === "newcairo" && p.price === 500)).toBe(true)
  })

  it("treats 0 as free (a real price)", () => {
    const r = parseWorkbook(buildWb({ priceRows: [["FIL-01", 0, 450]] }))
    expect(r.errors).toEqual([])
    expect(r.branchPrices).toContainEqual({ code: "FIL-01", branch: "newcairo", price: 0 })
  })
})

describe("parseWorkbook — validation errors", () => {
  it("errors when a required sheet is missing", () => {
    const r = parseWorkbook(buildWb({ skipSheet: "الأقسام" }))
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0].message).toContain("الأقسام")
  })

  it("errors when no known branch column is present", () => {
    const r = parseWorkbook(buildWb({ priceHeader: ["كود", "عمود مجهول"] }))
    expect(r.errors.some((e) => e.message.includes("عمود فرع"))).toBe(true)
  })

  it("errors on a non-numeric price", () => {
    const r = parseWorkbook(buildWb({ priceRows: [["FIL-01", "كتير", 450]] }))
    expect(r.errors.some((e) => e.message.includes("سعر مش رقم"))).toBe(true)
  })

  it("errors on a duplicate item code", () => {
    const r = parseWorkbook(
      buildWb({ items: [item("FIL-01", "فيلر"), item("FIL-01", "فيلر", "تاني")] })
    )
    expect(r.errors.some((e) => e.message.includes("مكرر"))).toBe(true)
  })

  it("errors when an item's category is not in الأقسام", () => {
    const r = parseWorkbook(buildWb({ items: [item("FIL-01", "قسم مش موجود")] }))
    expect(r.errors.some((e) => e.message.includes("مش موجود"))).toBe(true)
  })
})
