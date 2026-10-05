// Real seed-derived fixtures (supabase/seed.sql). Used by the engine tests so
// the cases mirror actual clinic data rather than invented numbers.

import type {
  BranchLaserCutoff,
  BranchPolicy,
  Doctor,
  DoctorContext,
  LaserConfig,
  Service,
} from "../types"
import type { LaserPriceEntry } from "../pricing"

// --- weekday reference (Sat=0): concrete 2026 dates for deterministic tests ---
export const SAT = "2026-10-10" // Saturday  (sat0 = 0)
export const SUN = "2026-10-11" // Sunday    (sat0 = 1)
export const MON = "2026-10-12" // Monday    (sat0 = 2)
export const TUE = "2026-10-13" // Tuesday   (sat0 = 3)
export const WED = "2026-10-14" // Wednesday (sat0 = 4)
export const THU = "2026-10-15" // Thursday  (sat0 = 5)

// --- services ---
export const LASER: Service = { code: "laser", usesLaserAreas: true, defaultDurationMin: 30 }
export const CONSULT: Service = { code: "consult", usesLaserAreas: false, defaultDurationMin: 30 }

// --- laser_areas (full seed list) ---
export const LASER_CONFIG: LaserConfig = {
  areas: [
    { code: "w_mustache", gender: "female", nameEn: "Mustache", hintAr: "موستاش", durationMin: 15, isSmall: true, isFullBody: false, requiresCompanion: false },
    { code: "w_bikini", gender: "female", nameEn: "Bikini", hintAr: "بكيني", durationMin: 15, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "w_bikiniline", gender: "female", nameEn: "Bikini Line", hintAr: "لازم مع أريا تانية", durationMin: 0, isSmall: false, isFullBody: false, requiresCompanion: true },
    { code: "w_underarm", gender: "female", nameEn: "Under Arms", hintAr: "أندر أرم", durationMin: 15, isSmall: true, isFullBody: false, requiresCompanion: false },
    { code: "w_face", gender: "female", nameEn: "Face", hintAr: "الوجه", durationMin: 15, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "w_neck", gender: "female", nameEn: "Neck", hintAr: "الرقبة", durationMin: 15, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "w_halfarms", gender: "female", nameEn: "Half Arms", hintAr: "نص الإيد", durationMin: 30, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "w_fullarms", gender: "female", nameEn: "Full Arms", hintAr: "الإيد كاملة", durationMin: 30, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "w_halflegup", gender: "female", nameEn: "Half-Legs-Upper", hintAr: "نص الرجل فوق", durationMin: 30, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "w_halflegdn", gender: "female", nameEn: "Half-Legs-Lower", hintAr: "نص الرجل تحت", durationMin: 30, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "w_fulllegs", gender: "female", nameEn: "Full Legs", hintAr: "الرجل كاملة", durationMin: 30, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "w_fbnb", gender: "female", nameEn: "Full Body WO Back & Belly", hintAr: "الجسم من غير بطن وضهر", durationMin: 60, isSmall: false, isFullBody: true, requiresCompanion: false },
    { code: "w_fb", gender: "female", nameEn: "Full Body", hintAr: "الجسم كامل", durationMin: 60, isSmall: false, isFullBody: true, requiresCompanion: false },
    { code: "m_ears", gender: "male", nameEn: "Ears", hintAr: "ودان", durationMin: 15, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "m_beard", gender: "male", nameEn: "Shaping Beard", hintAr: "تحديد الدقن", durationMin: 15, isSmall: true, isFullBody: false, requiresCompanion: false },
    { code: "m_underarm", gender: "male", nameEn: "Under Arms", hintAr: "الإبط", durationMin: 15, isSmall: true, isFullBody: false, requiresCompanion: false },
    { code: "m_halfface", gender: "male", nameEn: "Half Face", hintAr: "نص الوش", durationMin: 15, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "m_halfarms", gender: "male", nameEn: "Half Arms", hintAr: "نص الدراع", durationMin: 15, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "m_fullarms", gender: "male", nameEn: "Full Arms", hintAr: "الدراع كامل", durationMin: 15, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "m_chest", gender: "male", nameEn: "Full Chest", hintAr: "الصدر", durationMin: 15, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "m_back", gender: "male", nameEn: "Full Back", hintAr: "الضهر", durationMin: 15, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "m_legs", gender: "male", nameEn: "Full Legs", hintAr: "الرجل كاملة", durationMin: 15, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "m_upper", gender: "male", nameEn: "Upper Half", hintAr: "النص العلوي", durationMin: 15, isSmall: false, isFullBody: false, requiresCompanion: false },
    { code: "m_fbnobox", gender: "male", nameEn: "Full Body except Boxer", hintAr: "جسم كامل من غير بوكسر", durationMin: 60, isSmall: false, isFullBody: true, requiresCompanion: false },
    { code: "m_fbbox", gender: "male", nameEn: "Full Body inc Boxer", hintAr: "جسم كامل بالبوكسر", durationMin: 60, isSmall: false, isFullBody: true, requiresCompanion: false },
  ],
  conflicts: [
    { areaCode: "w_halfarms", conflictsWith: "w_fullarms" },
    { areaCode: "w_fullarms", conflictsWith: "w_halfarms" },
    { areaCode: "w_fulllegs", conflictsWith: "w_halflegup" },
    { areaCode: "w_fulllegs", conflictsWith: "w_halflegdn" },
    { areaCode: "w_halflegup", conflictsWith: "w_fulllegs" },
    { areaCode: "w_halflegdn", conflictsWith: "w_fulllegs" },
    { areaCode: "m_halfarms", conflictsWith: "m_fullarms" },
    { areaCode: "m_fullarms", conflictsWith: "m_halfarms" },
  ],
  combos: [
    { label: "كومبو Half-Legs + Half-Arms = ٣٠ دقيقة", requiredCodes: ["w_halfarms"], anyOfCodes: ["w_halflegup", "w_halflegdn"], durationAdjustMin: -30 },
    { label: "كومبو Under Arms + Bikini + Bikini Line = ٣٠ دقيقة", requiredCodes: ["w_underarm", "w_bikini", "w_bikiniline"], anyOfCodes: [], durationAdjustMin: 0 },
  ],
}

// --- laser_price_map (standard list, resolved item prices) ---
export const STANDARD_PRICES: LaserPriceEntry[] = [
  { areaCodes: ["w_underarm", "w_bikini"], label: "البكيني والأندر أرم (Bikini & Underarms)", single: 400, package3: 1100 },
  { areaCodes: ["w_face", "w_neck"], label: "الوجه والرقبة (Face & Neck)", single: 300, package3: 800 },
  { areaCodes: ["w_face"], label: "الوجه (Face)", single: 250, package3: 650 },
  { areaCodes: ["w_halfarms"], label: "نص الدراع (Half Arms)", single: 500, package3: 1300 },
]

// --- branch_policies ---
export const TANTA1_POLICY: BranchPolicy = {
  requestWindowDays: 1,
  sameDayAlwaysRequest: false,
  autoConfirmWeekdays: [0], // Saturday
  allowOverlap: true,
}
export const TANTA2_POLICY: BranchPolicy = {
  requestWindowDays: 1,
  sameDayAlwaysRequest: true,
  autoConfirmWeekdays: [],
  allowOverlap: true,
}

const TANTA2_LASER_CUTOFFS: BranchLaserCutoff[] = [
  { weekday: 2, shiftStartsBefore: "16:00", cutoff: "14:00" }, // Mon
  { weekday: 3, shiftStartsBefore: "16:00", cutoff: "14:00" }, // Tue
  { weekday: 5, shiftStartsBefore: "16:00", cutoff: "14:00" }, // Thu
]

// --- doctors ---
export const HEBA: Doctor = {
  id: "heba", branchId: "tanta1", displayName: "Dr Heba Ghonim",
  defaultBookingStatus: "open", acceptsMen: false, laserMenAllowed: true,
  menLaserAreaCodes: null, rejectsSmallAreasOnly: true, noOverlap: false,
  notes: "مش بتشتغل لرجالة.",
}
export const OLA: Doctor = {
  id: "ola", branchId: "shebin", displayName: "Dr Ola Gadallah",
  defaultBookingStatus: "confirmed", acceptsMen: true, laserMenAllowed: true,
  menLaserAreaCodes: ["m_beard", "m_underarm"], rejectsSmallAreasOnly: false, noOverlap: true,
  notes: "مع الرجالة: تحديد دقن وأندر أرم بس.",
}
export const MAHITAB: Doctor = {
  id: "mahitab", branchId: "shebin", displayName: "Dr Mahitab Sabry",
  defaultBookingStatus: "confirmed", acceptsMen: true, laserMenAllowed: true,
  menLaserAreaCodes: null, rejectsSmallAreasOnly: false, noOverlap: false,
  notes: null,
}
export const NOURHAN: Doctor = {
  id: "nourhan", branchId: "tanta2", displayName: "Dr Nourhan Hashem",
  defaultBookingStatus: "confirmed", acceptsMen: true, laserMenAllowed: true,
  menLaserAreaCodes: null, rejectsSmallAreasOnly: false, noOverlap: false,
  notes: null,
}
export const KHOLOUD: Doctor = {
  id: "kholoud", branchId: "kafrelsheikh", displayName: "Dr Kholoud Fayrouz",
  defaultBookingStatus: "confirmed", acceptsMen: true, laserMenAllowed: false,
  menLaserAreaCodes: null, rejectsSmallAreasOnly: false, noOverlap: false,
  notes: "ممنوع حجز ليزر رجالة معاها.",
}

// --- contexts (schedules + cut-offs + updates slot for the test to fill) ---
export const hebaCtx = (updates: DoctorContext["updates"] = []): DoctorContext => ({
  doctor: HEBA,
  schedules: [
    { weekday: 0, startTime: "10:00", endTime: "16:00", kind: "all" },
    { weekday: 1, startTime: "10:00", endTime: "16:00", kind: "all" },
    { weekday: 3, startTime: "10:00", endTime: "16:00", kind: "all" },
    { weekday: 4, startTime: "14:00", endTime: "20:00", kind: "all" },
    { weekday: 5, startTime: "13:00", endTime: "16:00", kind: "all" },
  ],
  laserCutoffs: [],
  branchLaserCutoffs: [],
  updates,
})

export const olaCtx = (): DoctorContext => ({
  doctor: OLA,
  schedules: [{ weekday: 4, startTime: "11:00", endTime: "16:00", kind: "all" }],
  laserCutoffs: [{ weekday: 4, cutoff: "17:00" }],
  branchLaserCutoffs: [],
  updates: [],
})

export const mahitabCtx = (): DoctorContext => ({
  doctor: MAHITAB,
  schedules: [
    { weekday: 0, startTime: "10:00", endTime: "18:00", kind: "laser" },
    { weekday: 0, startTime: "18:00", endTime: "22:00", kind: "other" },
    { weekday: 6, startTime: "12:00", endTime: "20:00", kind: "all" },
  ],
  laserCutoffs: [{ weekday: 0, cutoff: "18:00" }],
  branchLaserCutoffs: [],
  updates: [],
})

export const nourhanCtx = (): DoctorContext => ({
  doctor: NOURHAN,
  schedules: [
    { weekday: 0, startTime: "10:00", endTime: "16:00", kind: "derma" },
    { weekday: 1, startTime: "10:00", endTime: "16:00", kind: "all" },
    { weekday: 2, startTime: "10:00", endTime: "16:00", kind: "all" },
    { weekday: 3, startTime: "16:00", endTime: "22:00", kind: "all" },
    { weekday: 5, startTime: "16:00", endTime: "22:00", kind: "all" },
  ],
  laserCutoffs: [],
  branchLaserCutoffs: TANTA2_LASER_CUTOFFS,
  updates: [],
})

export const kholoudCtx = (): DoctorContext => ({
  doctor: KHOLOUD,
  schedules: [
    { weekday: 0, startTime: "10:00", endTime: "14:00", kind: "laser" },
    { weekday: 0, startTime: "14:00", endTime: "16:00", kind: "other" },
    { weekday: 2, startTime: "10:00", endTime: "16:00", kind: "all" },
    { weekday: 3, startTime: "10:00", endTime: "14:00", kind: "laser" },
    { weekday: 3, startTime: "14:00", endTime: "16:00", kind: "other" },
  ],
  laserCutoffs: [],
  branchLaserCutoffs: [],
  updates: [],
})
