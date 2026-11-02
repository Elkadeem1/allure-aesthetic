// Pure diff between a parsed price-list upload and the current DB rows.
// Drives the admin "preview before applying" step. No I/O here — unit-tested.

export type ParsedItem = { code: string; full_name: string; category_code: string | null }
export type ParsedPrice = { code: string; branch: string; price: number }
export type DbItem = { code: string; full_name: string; is_active: boolean }
export type DbPrice = { code: string; branch: string; price: number }

export type PriceChange = {
  code: string
  item: string
  branch: string // branch code
  branchName: string
  oldPrice: number | null // null = was not available
  newPrice: number | null // null = becomes not available
  pct: number | null // % change when both sides are numeric and old > 0
  big: boolean // |pct| > 30
}

export type ImportDiff = {
  counts: { newItems: number; changedItems: number; deactivatedItems: number }
  changes: PriceChange[]
}

const BIG_THRESHOLD = 30
const isInnova = (code: string) => code.startsWith("INV-")

export function diffPriceImport(args: {
  fileItems: ParsedItem[]
  filePrices: ParsedPrice[]
  dbItems: DbItem[]
  dbPrices: DbPrice[]
  branchNames: Record<string, string>
}): ImportDiff {
  const { fileItems, filePrices, dbItems, dbPrices, branchNames } = args

  const fileCodes = new Set(fileItems.map((i) => i.code))
  const dbCodes = new Set(dbItems.map((i) => i.code))
  const fileNameByCode = new Map(fileItems.map((i) => [i.code, i.full_name]))
  const dbNameByCode = new Map(dbItems.map((i) => [i.code, i.full_name]))

  // price lookups keyed "code|branch"
  const key = (c: string, b: string) => `${c}|${b}`
  const fileMap = new Map(filePrices.map((p) => [key(p.code, p.branch), p.price]))
  const dbMap = new Map(dbPrices.map((p) => [key(p.code, p.branch), p.price]))

  const newItems = fileItems.filter((i) => !dbCodes.has(i.code)).length
  const deactivatedItems = dbItems.filter(
    (i) => i.is_active && !isInnova(i.code) && !fileCodes.has(i.code)
  ).length

  const changes: PriceChange[] = []
  const changedCodes = new Set<string>()

  for (const item of fileItems) {
    // all branches that appear on either side for this item
    const branches = new Set<string>()
    for (const p of filePrices) if (p.code === item.code) branches.add(p.branch)
    for (const p of dbPrices) if (p.code === item.code) branches.add(p.branch)

    for (const branch of branches) {
      const oldPrice = dbMap.has(key(item.code, branch)) ? dbMap.get(key(item.code, branch))! : null
      const newPrice = fileMap.has(key(item.code, branch)) ? fileMap.get(key(item.code, branch))! : null
      if (oldPrice === newPrice) continue

      const pct =
        oldPrice !== null && newPrice !== null && oldPrice > 0
          ? ((newPrice - oldPrice) / oldPrice) * 100
          : null
      changes.push({
        code: item.code,
        item: fileNameByCode.get(item.code) ?? dbNameByCode.get(item.code) ?? item.code,
        branch,
        branchName: branchNames[branch] ?? branch,
        oldPrice,
        newPrice,
        pct,
        big: pct !== null && Math.abs(pct) > BIG_THRESHOLD,
      })
      if (dbCodes.has(item.code)) changedCodes.add(item.code)
    }
  }

  // big changes first, then by code + branch
  changes.sort((a, b) => Number(b.big) - Number(a.big) || a.code.localeCompare(b.code) || a.branch.localeCompare(b.branch))

  return {
    counts: { newItems, changedItems: changedCodes.size, deactivatedItems },
    changes,
  }
}
