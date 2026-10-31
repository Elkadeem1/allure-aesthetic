// Real seed-derived fixtures (supabase/seed.sql). Used by the engine tests so
// the cases mirror actual clinic data rather than invented numbers.

import type { Doctor, DoctorContext, LaserConfig, Service } from "../types"
import type { LaserAreaPrice, LaserPriceEntry, PriceBook, PriceCategory, PricedItem } from "../pricing"

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

// --- laser_price_map (standard list, resolved item prices) — for laserPrice() ---
export const STANDARD_PRICES: LaserPriceEntry[] = [
  { areaCodes: ["w_underarm", "w_bikini"], label: "البكيني والأندر أرم (Bikini & Underarms)", single: 400, package3: 1100 },
  { areaCodes: ["w_face", "w_neck"], label: "الوجه والرقبة (Face & Neck)", single: 300, package3: 800 },
  { areaCodes: ["w_face"], label: "الوجه (Face)", single: 250, package3: 650 },
  { areaCodes: ["w_halfarms"], label: "نص الدراع (Half Arms)", single: 500, package3: 1300 },
]

// ---------------------------------------------------------------------
// Per-branch PriceBook fixtures (migration-6 model).
// ---------------------------------------------------------------------
const CATS: PriceCategory[] = [
  { code: "CON", nameAr: "كشف الجلدية والشعر", nameEn: "Consultation", startsFrom: null },
  { code: "DPN", nameAr: "الديرمابن", nameEn: "Dermapen", startsFrom: 750 },
  { code: "LSR", nameAr: "ليزر إزالة الشعر", nameEn: "Laser", startsFrom: null },
  { code: "FIL", nameAr: "فيلر الوش", nameEn: "Face Fillers", startsFrom: null },
]

const item = (
  code: string,
  categoryCode: string,
  price: number | null,
  extra: Partial<PricedItem> = {}
): PricedItem => ({
  code,
  categoryCode,
  itemType: "service",
  fullName: code,
  groupName: null,
  variant: null,
  unit: null,
  price,
  priceText: null,
  doctorIds: null,
  ...extra,
})

export const LASER_MAP: LaserAreaPrice[] = [
  { areaCodes: ["w_face"], gender: "female", singleItemCode: "LSR-01", package3ItemCode: "LSR-02" },
  { areaCodes: ["w_face", "w_neck"], gender: "female", singleItemCode: "LSR-03", package3ItemCode: "LSR-04" },
  { areaCodes: ["w_bikini", "w_underarm"], gender: "female", singleItemCode: "LSR-05", package3ItemCode: "LSR-06" },
  { areaCodes: ["w_halfarms"], gender: "female", singleItemCode: "LSR-07", package3ItemCode: "LSR-08" },
  { areaCodes: ["m_upper"], gender: "male", singleItemCode: "LSR-37", package3ItemCode: null },
  { areaCodes: ["m_chest", "m_back"], gender: "male", singleItemCode: "LSR-36", package3ItemCode: null },
]

// A standard (non-Innova) branch that carries the common items.
export const STANDARD_BOOK: PriceBook = {
  categories: CATS,
  laserMap: LASER_MAP,
  items: [
    item("CON-01", "CON", 200, { fullName: "كشف بشرة أو شعر - أول مرة" }),
    item("CON-02", "CON", 150, { fullName: "كشف بشرة أو شعر - متابعة" }),
    item("CON-03", "CON", 300, { fullName: "كشف بشرة وشعر - أول مرة" }),
    item("CON-04", "CON", 250, { fullName: "كشف بشرة وشعر - متابعة" }),
    item("LSR-21", "LSR", 1, { unit: "نبضة", variant: "سعر النبضة", fullName: "ليزر سيدات - سعر النبضة" }),
    item("LSR-40", "LSR", 2, { unit: "نبضة", variant: "سعر النبضة", fullName: "ليزر رجال - سعر النبضة" }),
    item("LSR-01", "LSR", 250, { fullName: "الوجه (Face)" }),
    item("LSR-02", "LSR", 650),
    item("LSR-03", "LSR", 300, { fullName: "الوجه والرقبة (Face & Neck)" }),
    item("LSR-04", "LSR", 800),
    item("LSR-05", "LSR", 400, { fullName: "البكيني والأندر أرم (Bikini & Underarms)" }),
    item("LSR-06", "LSR", 1100),
    item("LSR-07", "LSR", 500, { fullName: "نص الدراع (Half Arms)" }),
    item("LSR-08", "LSR", 1300),
    item("LSR-37", "LSR", 120, { fullName: "النص العلوي (Half Upper)" }),
    item("DPN-01", "DPN", 900, { fullName: "ديرمابن - جلسة" }),
    item("FIL-01", "FIL", 1200, { fullName: "فيلر - سرنجة" }),
    item("FIL-02", "FIL", 50, { itemType: "addon", fullName: "فيلر - إضافة" }),
    item("FIL-03", "FIL", 0, { fullName: "فيلر - عرض" }),
  ],
}

// Kafr El-Sheikh: CON-05..08 exist, restricted to the two linked doctors.
export const KAFR_BOOK: PriceBook = {
  categories: CATS,
  laserMap: LASER_MAP,
  items: [
    item("CON-01", "CON", 200, { fullName: "كشف بشرة أو شعر - أول مرة" }),
    item("CON-02", "CON", 150, { fullName: "كشف بشرة أو شعر - متابعة" }),
    item("CON-05", "CON", 300, { fullName: "كشف — كفر الشيخ مع د. خلود/شيماء - أول مرة", doctorIds: ["kholoud", "shimaa"] }),
    item("CON-06", "CON", 200, { fullName: "كشف — كفر الشيخ مع د. خلود/شيماء - متابعة", doctorIds: ["kholoud", "shimaa"] }),
  ],
}

// Innova: the "Re Cons" item has a textual price, no numeric one.
export const INNOVA_BOOK: PriceBook = {
  categories: CATS,
  laserMap: LASER_MAP,
  items: [
    item("CON-01", "CON", 200, { fullName: "كشف Innova - أول مرة" }),
    item("INV-029", "CON", null, { fullName: "كشف Innova - إعادة كشف", priceText: "مجاني خلال شهر" }),
    item("LSR-21", "LSR", 2, { unit: "نبضة", variant: "سعر النبضة", fullName: "ليزر سيدات - سعر النبضة" }),
  ],
}

// --- doctors ---
export const HEBA: Doctor = {
  id: "heba", branchId: "tanta1", code: "hebaghonim", displayName: "Dr Heba Ghonim",
  defaultBookingStatus: "open", alwaysOpen: true, acceptsMen: false, laserMenAllowed: true,
  menLaserAreaCodes: null, rejectsSmallAreasOnly: true, noOverlap: false,
  specialty: null, notes: "مش بتشتغل لرجالة.", personKey: "hebaghonim",
}
export const OLA: Doctor = {
  id: "ola", branchId: "shebin", code: "olagadallah", displayName: "Dr Ola Gadallah",
  defaultBookingStatus: "confirmed", alwaysOpen: false, acceptsMen: true, laserMenAllowed: true,
  menLaserAreaCodes: ["m_beard", "m_underarm"], rejectsSmallAreasOnly: false, noOverlap: true,
  specialty: null, notes: "مع الرجالة: تحديد دقن وأندر أرم بس.", personKey: "olagadallah",
}
export const MAHITAB: Doctor = {
  id: "mahitab", branchId: "shebin", code: "mahitabsabry", displayName: "Dr Mahitab Sabry",
  defaultBookingStatus: "confirmed", alwaysOpen: false, acceptsMen: true, laserMenAllowed: true,
  menLaserAreaCodes: null, rejectsSmallAreasOnly: false, noOverlap: false,
  specialty: null, notes: null, personKey: "mahitabsabry",
}
export const NOURHAN: Doctor = {
  id: "nourhan", branchId: "tanta2", code: "nourhanhashem", displayName: "Dr Nourhan Hashem",
  defaultBookingStatus: "confirmed", alwaysOpen: false, acceptsMen: true, laserMenAllowed: true,
  menLaserAreaCodes: null, rejectsSmallAreasOnly: false, noOverlap: false,
  specialty: null, notes: null, personKey: "nourhanhashem",
}
export const KHOLOUD: Doctor = {
  id: "kholoud", branchId: "kafrelsheikh", code: "kholoudfayrouz", displayName: "Dr Kholoud Fayrouz",
  defaultBookingStatus: "confirmed", alwaysOpen: false, acceptsMen: true, laserMenAllowed: false,
  menLaserAreaCodes: null, rejectsSmallAreasOnly: false, noOverlap: false,
  specialty: null, notes: "ممنوع حجز ليزر رجالة معاها.", personKey: "kholoudfayrouz",
}
// Innova doctor: always Open.
export const EMAN: Doctor = {
  id: "eman", branchId: "innova", code: "emankarawya", displayName: "Dr Eman Karawya",
  defaultBookingStatus: "open", alwaysOpen: true, acceptsMen: false, laserMenAllowed: true,
  menLaserAreaCodes: null, rejectsSmallAreasOnly: false, noOverlap: false,
  specialty: null, notes: null, personKey: "emankarawya",
}

// --- contexts (schedules + cut-offs + rooms + updates slot for the test to fill) ---
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
  rooms: [],
  updates,
})

export const olaCtx = (updates: DoctorContext["updates"] = []): DoctorContext => ({
  doctor: OLA,
  schedules: [{ weekday: 4, startTime: "11:00", endTime: "16:00", kind: "all" }],
  laserCutoffs: [{ weekday: 4, cutoff: "17:00" }],
  branchLaserCutoffs: [],
  rooms: [],
  updates,
})

export const mahitabCtx = (updates: DoctorContext["updates"] = []): DoctorContext => ({
  doctor: MAHITAB,
  schedules: [
    { weekday: 0, startTime: "10:00", endTime: "18:00", kind: "laser" },
    { weekday: 0, startTime: "18:00", endTime: "22:00", kind: "other" },
    { weekday: 6, startTime: "12:00", endTime: "20:00", kind: "all" },
  ],
  laserCutoffs: [{ weekday: 0, cutoff: "18:00" }],
  branchLaserCutoffs: [],
  rooms: [],
  updates,
})

const TANTA2_LASER_CUTOFFS: DoctorContext["branchLaserCutoffs"] = [
  { weekday: 2, shiftStartsBefore: "16:00", cutoff: "14:00" }, // Mon
  { weekday: 3, shiftStartsBefore: "16:00", cutoff: "14:00" }, // Tue
  { weekday: 5, shiftStartsBefore: "16:00", cutoff: "14:00" }, // Thu
]

export const nourhanCtx = (updates: DoctorContext["updates"] = []): DoctorContext => ({
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
  rooms: [],
  updates,
})

export const kholoudCtx = (updates: DoctorContext["updates"] = []): DoctorContext => ({
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
  rooms: [],
  updates,
})
