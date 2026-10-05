// =====================================================================
// Laser area selection + session duration.
//   * toggleArea  — add/remove with conflict + full-body rules
//   * areasFor    — the areas offered to a gender
//   * companionMissing — Bikini-Line-style areas may not be booked alone
//   * laserMinutes / sessionMinutes — duration incl. combo adjustments
// =====================================================================

import type { Gender, LaserArea, LaserConfig, Service } from "./types"

export function areasFor(gender: Gender, areas: LaserArea[]): LaserArea[] {
  return areas.filter((a) => a.gender === gender)
}

function conflictsOf(code: string, cfg: LaserConfig): string[] {
  return cfg.conflicts.filter((c) => c.areaCode === code).map((c) => c.conflictsWith)
}

/**
 * Toggle an area in the current selection, returning a NEW array.
 *   - already selected      -> removed
 *   - a full-body area      -> replaces the whole selection (excludes all)
 *   - otherwise             -> drop any full-body area + any conflicting
 *                              area (half <-> full), then add it
 */
export function toggleArea(selected: string[], code: string, cfg: LaserConfig): string[] {
  const area = cfg.areas.find((a) => a.code === code)
  if (selected.includes(code)) return selected.filter((x) => x !== code)
  if (area?.isFullBody) return [code]

  const withoutFullBody = selected.filter((x) => {
    const o = cfg.areas.find((a) => a.code === x)
    return !(o && o.isFullBody)
  })
  const bad = conflictsOf(code, cfg)
  return withoutFullBody.filter((x) => !bad.includes(x)).concat(code)
}

/**
 * True when the selection is a single companion-requiring area (e.g. Bikini
 * Line), which must always be booked alongside another area.
 */
export function companionMissing(selected: string[], areas: LaserArea[]): boolean {
  if (selected.length !== 1) return false
  const a = areas.find((x) => x.code === selected[0])
  return !!a?.requiresCompanion
}

export type LaserDuration = { total: number; adjustments: string[] }

/** Sum of area durations with combo adjustments applied once each. */
export function laserMinutes(selected: string[], cfg: LaserConfig): LaserDuration {
  let total = 0
  for (const code of selected) {
    const a = cfg.areas.find((x) => x.code === code)
    if (a) total += a.durationMin
  }
  const adjustments: string[] = []
  for (const combo of cfg.combos) {
    const hasAllRequired = combo.requiredCodes.every((c) => selected.includes(c))
    const hasAnyOf =
      combo.anyOfCodes.length === 0 || combo.anyOfCodes.some((c) => selected.includes(c))
    if (hasAllRequired && hasAnyOf) {
      total += combo.durationAdjustMin
      adjustments.push(combo.label)
    }
  }
  return { total: Math.max(total, 0), adjustments }
}

/** Session length in minutes: laser = areas (+combos); any other service = its fixed duration. */
export function sessionMinutes(service: Service, selected: string[], cfg: LaserConfig): number {
  if (!service.usesLaserAreas) return service.defaultDurationMin
  return laserMinutes(selected, cfg).total
}
