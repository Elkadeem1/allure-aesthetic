// =====================================================================
// Shared price-list Excel parsing (docs/data/price-list.xlsx format).
//
// Used by BOTH scripts/import-prices.mjs (seed a fresh DB) and the admin
// "upload price list" page (lib/admin/prices + the server action), so the
// column mapping and validation live in exactly one place.
//
// parseWorkbook() does NOT read Innova (INV-xxx) — those live in the HTML
// and the admin Excel upload must never touch them.
// =====================================================================

// Excel branch column header -> our branch code.
export const BRANCH_BY_HEADER = {
  'التجمع الخامس': 'newcairo',
  'طنطا شارع السعيد': 'tanta2',
  'طنطا شارع الاستاد': 'tanta1',
  'المنصورة': 'mansoura',
  'كفر الشيخ': 'kafrelsheikh',
  'شبين الكوم': 'shebin',
}

// Category code -> knowledge-base slug + "يبدأ من" overrides.
export const CATEGORY_KB = {
  FIL: 'def:filler', BTX: 'def:botox', LSR: 'def:laser', MES: 'def:meso',
  PEL: 'def:peeling', SKB: 'def:skinbooster', PLA: 'def:pllaexo', EXO: 'def:pllaexo',
}
export const CATEGORY_STARTS_FROM = { DPN: 750 }

export const REQUIRED_SHEETS = ['الأقسام', 'قائمة الأسعار', 'الأسعار حسب الفرع']

// ---------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------
export const cellText = (c) => {
  const v = c?.value
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    if ('text' in v) return v.text
    if ('result' in v) return v.result
    if ('richText' in v) return v.richText.map((r) => r.text).join('')
    if ('hyperlink' in v) return v.text || v.hyperlink
    return ''
  }
  return v
}
export const str = (v) => String(v ?? '').trim()

// Legacy helper kept for the Innova path in the script.
export const priceNum = (v) => {
  if (v === '' || v === null || v === undefined) return null
  const n = parseFloat(String(v).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : null
}

// A price cell: empty -> not available (null); a real number -> price;
// anything else with content -> invalid (reported as an error).
export function parsePriceCell(raw) {
  const s = str(raw)
  if (s === '') return { price: null }
  const cleaned = s.replace(/[^\d.]/g, '')
  const n = parseFloat(cleaned)
  if (cleaned === '' || !Number.isFinite(n)) return { invalid: true }
  return { price: n }
}

// ---------------------------------------------------------------------
// parseWorkbook(wb) -> { categories, items, branchPrices, errors }
//   errors: [{ sheet, row, message }]  (Arabic; empty = file is valid)
// ---------------------------------------------------------------------
export function parseWorkbook(wb) {
  const errors = []
  const err = (sheet, row, message) => errors.push({ sheet, row, message })

  for (const name of REQUIRED_SHEETS) {
    if (!wb.getWorksheet(name)) err(name, 0, `الشيت «${name}» مش موجود في الملف.`)
  }
  if (errors.length) return { categories: [], items: [], branchPrices: [], errors }

  // --- categories (الأقسام) ---
  const categories = []
  const catCodeByAr = new Map()
  const seenCat = new Set()
  let csort = 0
  wb.getWorksheet('الأقسام').eachRow((row, rn) => {
    if (rn === 1) return
    const code = str(cellText(row.getCell(1)))
    const nameAr = str(cellText(row.getCell(2)))
    if (!code && !nameAr) return
    if (!code) return err('الأقسام', rn, 'القسم من غير كود.')
    if (!nameAr) return err('الأقسام', rn, `القسم «${code}» من غير اسم.`)
    if (seenCat.has(code)) return err('الأقسام', rn, `كود قسم مكرر: ${code}.`)
    seenCat.add(code)
    categories.push({
      code,
      name_ar: nameAr,
      name_en: str(cellText(row.getCell(3))) || null,
      sort: csort++,
      kb_slug: CATEGORY_KB[code] || null,
      starts_from: CATEGORY_STARTS_FROM[code] ?? null,
    })
    catCodeByAr.set(nameAr, code)
  })

  // --- descriptive columns (قائمة الأسعار) ---
  const desc = new Map()
  const seenItem = new Set()
  let isort = 0
  wb.getWorksheet('قائمة الأسعار').eachRow((row, rn) => {
    if (rn === 1) return
    const code = str(cellText(row.getCell(1)))
    const fullName = str(cellText(row.getCell(7)))
    if (!code && !fullName) return
    if (!code) return err('قائمة الأسعار', rn, 'بند من غير كود.')
    if (seenItem.has(code)) return err('قائمة الأسعار', rn, `كود بند مكرر: ${code}.`)
    seenItem.add(code)
    const typeAr = str(cellText(row.getCell(8)))
    desc.set(code, {
      code,
      category_ar: str(cellText(row.getCell(2))),
      group_name: str(cellText(row.getCell(4))) || null,
      variant: str(cellText(row.getCell(5))) || null,
      unit: str(cellText(row.getCell(6))) || null,
      full_name: fullName || code,
      item_type: typeAr === 'إضافة' ? 'addon' : 'service',
      availability_text: str(cellText(row.getCell(11))) || null,
      notes: str(cellText(row.getCell(12))) || null,
      sort: isort++,
    })
  })

  // --- per-branch prices (الأسعار حسب الفرع) ---
  const priceSheet = wb.getWorksheet('الأسعار حسب الفرع')
  const branchCol = {}
  priceSheet.getRow(1).eachCell((cell, col) => {
    const code = BRANCH_BY_HEADER[str(cellText(cell))]
    if (code) branchCol[col] = code
  })
  if (Object.keys(branchCol).length === 0) {
    err('الأسعار حسب الفرع', 1, 'مفيش أي عمود فرع معروف في أول صف.')
  }

  const items = []
  const branchPrices = []
  priceSheet.eachRow((row, rn) => {
    if (rn === 1) return
    const code = str(cellText(row.getCell(1)))
    if (!code) {
      // a fully-empty row is fine; a row with prices but no code is not
      const hasAny = Object.keys(branchCol).some((col) => str(cellText(row.getCell(Number(col)))) !== '')
      if (hasAny) err('الأسعار حسب الفرع', rn, 'صف فيه أسعار من غير كود بند.')
      return
    }
    const d = desc.get(code)
    if (!d) return err('الأسعار حسب الفرع', rn, `البند ${code} مالوش صف في «قائمة الأسعار».`)
    const catCode = catCodeByAr.get(d.category_ar)
    if (!catCode) {
      err('الأسعار حسب الفرع', rn, `البند ${code}: القسم «${d.category_ar}» مش موجود في «الأقسام».`)
    }
    items.push({
      code,
      category_code: catCode || null,
      group_name: d.group_name,
      variant: d.variant,
      unit: d.unit,
      full_name: d.full_name,
      item_type: d.item_type,
      availability_text: d.availability_text,
      notes: d.notes,
      price_text: null,
      sort: d.sort,
    })
    for (const [col, branch] of Object.entries(branchCol)) {
      const parsed = parsePriceCell(cellText(row.getCell(Number(col))))
      if (parsed.invalid) {
        err('الأسعار حسب الفرع', rn, `سعر مش رقم للبند ${code} في ${branch}.`)
      } else if (parsed.price !== null) {
        branchPrices.push({ code, branch, price: parsed.price })
      }
    }
  })

  return { categories, items, branchPrices, errors }
}
