// =====================================================================
// Pricing — the per-branch price model (migration 6).
//
// price_categories × price_items × price_item_branch_prices (+ per-doctor
// restrictions and the laser_area_price_map). A PriceBook is resolved for
// ONE branch by the data loader: each item already carries its branch
// price (null = not offered here) and price_text, so the engine stays
// Supabase-free.
//
// Ported from docs/mvp/agent-hub-2026-10.html (priceHtml / bestNonLaser).
// Rules:
//   * consultation card = CON items offered here, for the chosen doctor
//     (CON-01..04 for everyone, CON-05..08 only for their linked Kafr
//     El-Sheikh doctors), incl. the Innova "Re Cons" price_text item.
//   * pulse price = LSR-21 (women) / LSR-40 (men).
//   * a laser area with no standalone price returns the bundle that
//     contains it + the per-pulse price — we NEVER invent a number.
//   * a category's "يبدأ من" = starts_from if set, else the cheapest
//     active 'service' item in the branch (ignoring addons, pulse and 0).
// =====================================================================

import type { Gender, LaserConfig } from "./types"

// ---------------------------------------------------------------------
// Laser bundle/single pricing over already-resolved entries.
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// The per-branch price model.
// ---------------------------------------------------------------------
export type PriceCategory = {
  code: string
  nameAr: string
  nameEn: string | null
  startsFrom: number | null // admin "يبدأ من" override
}

export type PricedItem = {
  code: string
  categoryCode: string
  itemType: "service" | "addon"
  fullName: string
  groupName: string | null
  variant: string | null
  unit: string | null
  price: number | null // this branch's price; null = not offered here
  priceText: string | null // textual price (e.g. Innova Re Cons "مجاني خلال شهر")
  doctorIds: string[] | null // null = all doctors; else restricted to these
}

export type LaserAreaPrice = {
  areaCodes: string[]
  gender: Gender
  singleItemCode: string
  package3ItemCode: string | null
}

// Everything needed to price any service for ONE branch.
export type PriceBook = {
  categories: PriceCategory[]
  items: PricedItem[]
  laserMap: LaserAreaPrice[]
}

// pulse (سعر النبضة) codes — the UI reads these directly.
const PULSE_CODE: Record<Gender, string> = { female: "LSR-21", male: "LSR-40" }

export function itemByCode(book: PriceBook, code: string): PricedItem | undefined {
  return book.items.find((i) => i.code === code)
}

/** Per-pulse price for this branch/gender (LSR-21 women / LSR-40 men). */
export function pulsePrice(book: PriceBook, gender: Gender): number | null {
  return itemByCode(book, PULSE_CODE[gender])?.price ?? null
}

/** A category's "يبدأ من": the admin override, else the cheapest active
 *  'service' item in this branch (addons, pulse and 0-priced excluded). */
export function categoryStartsFrom(book: PriceBook, categoryCode: string): number | null {
  const cat = book.categories.find((c) => c.code === categoryCode)
  if (!cat) return null
  if (cat.startsFrom != null) return cat.startsFrom
  const prices = book.items
    .filter(
      (it) =>
        it.categoryCode === categoryCode &&
        it.itemType === "service" &&
        it.unit !== "نبضة" &&
        it.price != null &&
        it.price > 0
    )
    .map((it) => it.price as number)
  return prices.length ? Math.min(...prices) : null
}

export type ConsultItem = {
  code: string
  label: string
  price: number | null
  priceText: string | null
}

/** The consultation card: CON items offered here and allowed for `doctorId`. */
export function consultationCard(book: PriceBook, doctorId?: string | null): ConsultItem[] {
  return book.items
    .filter(
      (it) =>
        it.categoryCode === "CON" &&
        (it.price != null || it.priceText != null) &&
        (it.doctorIds == null || (doctorId != null && it.doctorIds.includes(doctorId)))
    )
    .map((it) => ({ code: it.code, label: it.fullName, price: it.price, priceText: it.priceText }))
}

export type LaserAreaUnpriced = {
  areaCode: string
  label: string
  bundle: { label: string; areaCodes: string[] } | null // the bundle that contains it
  pulse: number | null
}

export type LaserAreaResult = {
  lines: LaserPriceLine[]
  singleTotal: number
  package3Total: number | null
  noStandalone: LaserAreaUnpriced[] // areas with no standalone price in this branch
}

/**
 * Price the selected laser areas for this branch using the laser_area_price_map.
 * Bundles (Face+Neck, Bikini+Underarms, men Chest+Back) win over their singles.
 * An area with no standalone price is reported in `noStandalone` together with
 * the bundle that contains it and the per-pulse price — never a made-up number.
 */
export function laserAreaPricing(
  selected: string[],
  gender: Gender,
  book: PriceBook,
  cfg: LaserConfig
): LaserAreaResult {
  const pulse = pulsePrice(book, gender)

  const entries = book.laserMap
    .filter((m) => m.gender === gender)
    .map((m) => {
      const single = itemByCode(book, m.singleItemCode)
      const pkg = m.package3ItemCode ? itemByCode(book, m.package3ItemCode) : null
      return {
        areaCodes: m.areaCodes,
        label: single?.fullName ?? m.singleItemCode,
        single: single?.price ?? null,
        package3: pkg?.price ?? null,
      }
    })
  const bundles = entries
    .filter((e) => e.areaCodes.length > 1)
    .sort((a, b) => b.areaCodes.length - a.areaCodes.length)
  const singles = entries.filter((e) => e.areaCodes.length === 1)

  // Companion-only areas are priced as part of their partner, never alone.
  const sel = new Set(
    selected.filter((code) => !cfg.areas.find((a) => a.code === code)?.requiresCompanion)
  )

  const lines: LaserPriceLine[] = []
  for (const b of bundles) {
    if (b.single != null && b.areaCodes.every((c) => sel.has(c))) {
      b.areaCodes.forEach((c) => sel.delete(c))
      lines.push({ areaCodes: b.areaCodes, label: b.label, single: b.single, package3: b.package3 })
    }
  }

  const noStandalone: LaserAreaUnpriced[] = []
  for (const code of [...sel]) {
    const s = singles.find((e) => e.areaCodes[0] === code)
    if (s && s.single != null) {
      lines.push({ areaCodes: [code], label: s.label, single: s.single, package3: s.package3 })
    } else {
      const bundle = bundles.find((b) => b.areaCodes.includes(code))
      const area = cfg.areas.find((a) => a.code === code)
      noStandalone.push({
        areaCode: code,
        label: area?.hintAr ?? area?.nameEn ?? code,
        bundle: bundle ? { label: bundle.label, areaCodes: bundle.areaCodes } : null,
        pulse,
      })
    }
  }

  const singleTotal = lines.reduce((t, l) => t + l.single, 0)
  const allHavePackage = lines.length > 0 && lines.every((l) => l.package3 != null)
  const package3Total = allHavePackage ? lines.reduce((t, l) => t + (l.package3 as number), 0) : null

  return { lines, singleTotal, package3Total, noStandalone }
}
