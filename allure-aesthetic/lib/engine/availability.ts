// =====================================================================
// Doctor availability.
//   * windowsFor — valid start-time windows on a date, respecting branch/
//     doctor "off/stop" blocks, "hours" overrides, laser compatibility of
//     each shift segment, and laser cut-offs (doctor + branch).
//   * evalDoctor — can this doctor take this service/gender/areas on this
//     date at all? Returns ok + clear Arabic reasons + notes.
// =====================================================================

import type { DoctorContext, DoctorUpdate, LaserConfig, Service, ShiftKind, Gender } from "./types"
import { DAY_LABELS, hm, tLabel, weekdaySat0 } from "./time"

export type Segment = { from: number; to: number; kind: ShiftKind }
export type Window = { from: number; to: number; cut: number | null; derma: boolean }

export type WindowsResult = {
  weekday: number
  blocked: DoctorUpdate | null // off/stop that applies (doctor or branch-wide)
  branchWideBlock: boolean // true when `blocked` is a branch-wide row
  hoursUpdate: DoctorUpdate | null
  segments: Segment[] // the raw day segments (schedule or hours override)
  windows: Window[] // compatible, cut-off-clamped, merged
  cutoffApplied: boolean
}

function activeUpdates(ctx: DoctorContext, date: string): DoctorUpdate[] {
  return ctx.updates.filter(
    (u) =>
      (u.doctorId === ctx.doctor.id || u.doctorId === null) &&
      u.dateFrom <= date &&
      date <= u.dateTo
  )
}

/** Is a shift segment of this kind usable for the chosen service? */
function compatible(service: Service, kind: ShiftKind): boolean {
  return service.usesLaserAreas ? kind === "all" || kind === "laser" : kind !== "laser"
}

export function windowsFor(
  ctx: DoctorContext,
  args: { date: string; service: Service }
): WindowsResult {
  const { date, service } = args
  const weekday = weekdaySat0(date)
  const laser = service.usesLaserAreas
  const ups = activeUpdates(ctx, date)

  const res: WindowsResult = {
    weekday,
    blocked: null,
    branchWideBlock: false,
    hoursUpdate: null,
    segments: [],
    windows: [],
    cutoffApplied: false,
  }

  const blk = ups.find((u) => u.type === "off" || u.type === "stop")
  if (blk) {
    res.blocked = blk
    res.branchWideBlock = blk.doctorId === null
    return res
  }

  const hu = ups.find((u) => u.type === "hours" && u.segments.length > 0)
  if (hu) {
    res.hoursUpdate = hu
    res.segments = hu.segments.map((s) => ({ from: hm(s.start), to: hm(s.end), kind: s.kind ?? "all" }))
  } else {
    res.segments = ctx.schedules
      .filter((s) => s.weekday === weekday)
      .map((s) => ({ from: hm(s.startTime), to: hm(s.endTime), kind: s.kind }))
  }

  const docCut = laser ? ctx.laserCutoffs.find((c) => c.weekday === weekday) : undefined
  const brCut = laser ? ctx.branchLaserCutoffs.find((c) => c.weekday === weekday) : undefined

  const out: Window[] = []
  for (const s0 of res.segments) {
    if (!compatible(service, s0.kind)) continue
    const w: Window = { from: s0.from, to: s0.to, cut: null, derma: s0.kind === "derma" }
    if (laser) {
      if (docCut) {
        const c = hm(docCut.cutoff)
        if (c < w.to) {
          w.to = c
          w.cut = c
          res.cutoffApplied = true
        }
      }
      // Branch cut-off only bites morning shifts (those starting before the threshold).
      if (brCut && s0.from < hm(brCut.shiftStartsBefore)) {
        const c = hm(brCut.cutoff)
        if (c < w.to) {
          w.to = c
          w.cut = c
          res.cutoffApplied = true
        }
      }
    }
    if (w.to > w.from) out.push(w)
  }

  out.sort((a, b) => a.from - b.from)
  const merged: Window[] = []
  for (const w of out) {
    const last = merged[merged.length - 1]
    if (last && w.from <= last.to) {
      last.to = Math.max(last.to, w.to)
      last.cut = last.cut ?? w.cut
      last.derma = last.derma || w.derma
    } else {
      merged.push({ ...w })
    }
  }
  res.windows = merged
  return res
}

/**
 * The date-independent reasons a doctor can't take this service/gender/areas:
 * gender rules, men-laser restrictions, small-areas-only. Used both by
 * evalDoctor and by the doctor-picker (which runs before a date is chosen).
 */
export function doctorRuleReasons(
  ctx: DoctorContext,
  args: { service: Service; gender: Gender; areas: string[] },
  cfg: LaserConfig
): string[] {
  const { service, gender, areas } = args
  const d = ctx.doctor
  const laser = service.usesLaserAreas
  const male = gender === "male"
  const reasons: string[] = []

  const areaName = (code: string) => {
    const a = cfg.areas.find((x) => x.code === code)
    return a?.hintAr ?? a?.nameEn ?? code
  }

  if (male && !d.acceptsMen) reasons.push("بتستقبل سيدات بس")
  if (male && laser && !d.laserMenAllowed) reasons.push("ممنوع ليزر رجالة معاها")
  if (male && laser && d.menLaserAreaCodes) {
    const allowed = d.menLaserAreaCodes
    const bad = areas.filter((a) => !allowed.includes(a))
    if (bad.length) reasons.push("مع الرجالة بتعمل " + allowed.map(areaName).join(" و") + " بس")
  }
  if (
    laser &&
    d.rejectsSmallAreasOnly &&
    areas.length > 0 &&
    areas.every((a) => cfg.areas.find((x) => x.code === a)?.isSmall)
  ) {
    reasons.push(
      "مش بتستقبل الأريات الصغيرة (موستاش / دقن / أندر أرم بس) — بتتحوّل على باقي الدكاترة"
    )
  }
  return reasons
}

/** Date-independent advisory hints for a doctor (no overlap, free-text notes). */
export function doctorNotes(doctor: DoctorContext["doctor"]): string[] {
  const notes: string[] = []
  if (doctor.noOverlap) notes.push("الدكتورة دي ما بنعملش معاها أوفر لاب حتى لو السيستم مليان")
  if (doctor.notes) notes.push(doctor.notes)
  return notes
}

export type EvalResult = {
  ok: boolean
  reasons: string[] // why NOT available (empty when ok)
  notes: string[] // advisories that don't block
  windows: Window[]
}

export function evalDoctor(
  ctx: DoctorContext,
  args: { date: string; service: Service; gender: Gender; areas: string[] },
  cfg: LaserConfig
): EvalResult {
  const { date, service } = args
  const d = ctx.doctor
  const laser = service.usesLaserAreas
  const reasons: string[] = doctorRuleReasons(ctx, args, cfg)
  const notes: string[] = []

  // ----- date-based availability -----
  const w = windowsFor(ctx, { date, service })
  const dn = DAY_LABELS[w.weekday]
  if (w.blocked) {
    if (w.branchWideBlock) {
      reasons.push(
        w.blocked.type === "off"
          ? `الفرع مقفول يوم ${dn} — Update من الفرع`
          : `الفرع محجوز بالكامل يوم ${dn} — Update من الفرع`
      )
    } else {
      reasons.push(
        w.blocked.type === "off"
          ? `غايبة يوم ${dn} — Update من الفرع`
          : `حجزها متوقف يوم ${dn} — Update من الفرع`
      )
    }
    if (w.blocked.note) reasons.push("الملاحظة: " + w.blocked.note)
  } else if (w.segments.length === 0) {
    reasons.push(`مش شغالة يوم ${dn}`)
  } else if (w.windows.length === 0) {
    reasons.push(
      laser
        ? `الفترات اللي شغالة فيها يوم ${dn} مفيهاش ليزر (أو بعد آخر ميعاد ليزر)`
        : `الفترات اللي شغالة فيها يوم ${dn} ليزر بس`
    )
  }

  // ----- advisories -----
  notes.push(...doctorNotes(d))
  if (w.hoursUpdate) {
    notes.push(
      `Update من الفرع: ساعاتها يوم ${dn} مختلفة` +
        (w.hoursUpdate.note ? ` — ${w.hoursUpdate.note}` : "")
    )
  }
  for (const x of w.windows) {
    if (x.cut != null) {
      notes.push(`آخر ميعاد ليزر يوم ${dn} الساعة ${tLabel(x.cut)} — ممنوع ليزر بعده`)
    }
    if (x.derma) notes.push(`جزء من شيفتها جلدية بس يوم ${dn} — اتأكد إن الخدمة تنفع`)
  }

  return { ok: reasons.length === 0, reasons, notes, windows: w.windows }
}
