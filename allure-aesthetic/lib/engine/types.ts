// =====================================================================
// Booking engine — input/output shapes.
//
// Pure data: these mirror the DB tables (camelCased) but carry NO Supabase
// coupling. Callers load rows and pass plain objects in; the engine returns
// plain results. Dates are "YYYY-MM-DD" strings, times "HH:MM", and the
// weekday numbering is Saturday = 0 … Friday = 6 (see time.ts / the SQL
// weekday_sat0()). All date reasoning is Africa/Cairo: the caller resolves
// "today" (cairo_today()) and passes it in.
// =====================================================================

export type Gender = "female" | "male"
export type ShiftKind = "all" | "laser" | "other" | "derma"
export type BookingStatus = "open" | "confirmed"
export type TicketKind = "request" | "notice"

export type UpdateType =
  | "off"        // غايبة / branch closed-or-event when branch-wide
  | "stop"       // وقف حجز / branch fully-booked when branch-wide
  | "hours"      // ساعات مختلفة — replaces the fixed schedule for those days
  | "open_slot"  // الدور فاضي — book Confirmed instead of Open
  | "force_open" // book Open instead of Confirmed
  | "note"       // informational banner only

// doctors (a row = a doctor AT one branch)
export type Doctor = {
  id: string
  branchId: string
  displayName: string
  defaultBookingStatus: BookingStatus
  acceptsMen: boolean
  laserMenAllowed: boolean
  menLaserAreaCodes: string[] | null // null = all men areas allowed
  rejectsSmallAreasOnly: boolean
  noOverlap: boolean
  notes: string | null
}

// doctor_schedules — one row per shift segment
export type DoctorSchedule = {
  weekday: number
  startTime: string
  endTime: string
  kind: ShiftKind
}

// doctor_laser_cutoffs — doctor's last-laser time on a weekday
export type DoctorLaserCutoff = {
  weekday: number
  cutoff: string
}

// branch_laser_cutoffs — morning shifts (starting before shiftStartsBefore)
// take no laser after `cutoff` on the given weekday
export type BranchLaserCutoff = {
  weekday: number
  shiftStartsBefore: string
  cutoff: string
}

// branch_policies — drives the ticket-kind decision
export type BranchPolicy = {
  requestWindowDays: number
  sameDayAlwaysRequest: boolean
  autoConfirmWeekdays: number[]
  allowOverlap: boolean
}

// doctor_updates — temporary changes. doctorId null = branch-wide.
export type UpdateSegment = { start: string; end: string; kind?: ShiftKind }
export type DoctorUpdate = {
  id: string
  doctorId: string | null
  type: UpdateType
  dateFrom: string
  dateTo: string
  segments: UpdateSegment[]
  note: string | null
  createdAt: string // ISO timestamp — used to break override ties (latest wins)
}

// services
export type Service = {
  code: string
  usesLaserAreas: boolean
  defaultDurationMin: number
}

// laser_areas / laser_area_conflicts / laser_area_combos
export type LaserArea = {
  code: string
  gender: Gender
  nameEn: string
  hintAr: string | null
  durationMin: number
  isSmall: boolean
  isFullBody: boolean
  requiresCompanion: boolean
}
export type AreaConflict = { areaCode: string; conflictsWith: string }
export type AreaCombo = {
  label: string
  requiredCodes: string[]
  anyOfCodes: string[]
  durationAdjustMin: number
}

// Everything the area/duration/pricing helpers need, loaded once.
export type LaserConfig = {
  areas: LaserArea[]
  conflicts: AreaConflict[]
  combos: AreaCombo[]
}

// Everything a single doctor's availability check needs. `updates` holds both
// this doctor's rows and branch-wide rows (doctorId === null); the engine
// filters by date and scope internally.
export type DoctorContext = {
  doctor: Doctor
  schedules: DoctorSchedule[]
  laserCutoffs: DoctorLaserCutoff[]
  branchLaserCutoffs: BranchLaserCutoff[]
  updates: DoctorUpdate[]
}
