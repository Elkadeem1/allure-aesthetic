// =====================================================================
// Laser pricing.
//
// Matches bundles first (Face+Neck, Bikini+Under Arms, Chest+Back …), then
// prices the remaining single areas. Companion-only areas (Bikini Line) have
// no price of their own and are dropped. Returns the single-session total and
// the 3-session package total (only when every priced line has a package).
//
// A LaserPriceEntry is one row of laser_price_map with its item prices already
// resolved (single + optional 3-session package) — the engine stays Supabase-free.
// =====================================================================

import type { LaserConfig } from "./types"

export type LaserPriceEntry = {
  areaCodes: string[] // one code = single area; many = a bundle
  label: string
  single: number
  package3: number | null
}

export type LaserPriceLine = {
  areaCodes: string[]
  label: string
  single: number
  package3: number | null
}

export type LaserPriceResult = {
  lines: LaserPriceLine[]
  singleTotal: number
  package3Total: number | null // null when any priced line lacks a package
  unpriced: string[] // selected area codes with no matching entry
}

export function laserPrice(
  selected: string[],
  entries: LaserPriceEntry[],
  cfg: LaserConfig
): LaserPriceResult {
  const sel = new Set(selected)

  // Companion-only areas (e.g. Bikini Line) are never individually priced.
  for (const code of [...sel]) {
    const a = cfg.areas.find((x) => x.code === code)
    if (a?.requiresCompanion) sel.delete(code)
  }

  const lines: LaserPriceLine[] = []

  // Bundles first, largest bundle first so the widest match wins.
  const bundles = entries
    .filter((e) => e.areaCodes.length > 1)
    .sort((a, b) => b.areaCodes.length - a.areaCodes.length)
  const singles = entries.filter((e) => e.areaCodes.length === 1)

  for (const b of bundles) {
    if (b.areaCodes.every((c) => sel.has(c))) {
      b.areaCodes.forEach((c) => sel.delete(c))
      lines.push({ areaCodes: b.areaCodes, label: b.label, single: b.single, package3: b.package3 })
    }
  }

  const unpriced: string[] = []
  for (const code of [...sel]) {
    const s = singles.find((e) => e.areaCodes[0] === code)
    if (s) {
      sel.delete(code)
      lines.push({ areaCodes: [code], label: s.label, single: s.single, package3: s.package3 })
    } else {
      unpriced.push(code)
    }
  }

  const singleTotal = lines.reduce((t, l) => t + l.single, 0)
  const allHavePackage = lines.length > 0 && lines.every((l) => l.package3 != null)
  const package3Total = allHavePackage ? lines.reduce((t, l) => t + (l.package3 as number), 0) : null

  return { lines, singleTotal, package3Total, unpriced }
}
