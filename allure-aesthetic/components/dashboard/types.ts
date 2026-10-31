export type DoctorScheduleEntry = {
  id: string
  weekday: number // 0=Sat … 6=Fri
  startTime: string
  endTime: string
  kind: string
}

export type DoctorUpdate = {
  id: string
  doctorId: string | null
  type: string // off | stop | hours | open_slot | force_open | note | laser_stop | booking_cutoff | full
  dateFrom: string
  dateTo: string
  atTime: string | null
  weekdays: number[]
  note: string | null
  segments: Array<{ start: string; end: string; kind?: string }>
}

export type RoomAssignment = {
  weekday: number
  roomId: string
  roomTitle: string
}

export type DoctorData = {
  id: string
  displayName: string
  notes: string | null
  specialty: string | null
  sort: number
  // rule flags (display tags only)
  acceptsMen: boolean
  laserMenAllowed: boolean
  menLaserAreaCodes: string[] | null
  rejectsSmallAreasOnly: boolean
  noOverlap: boolean
  schedules: DoctorScheduleEntry[]
  rooms: RoomAssignment[]
}

export type RoomInfo = {
  id: string
  code: string
  title: string
  sort: number
}

// One consultation line for the branch header (CON items + Innova Re Cons).
export type ConsultRow = {
  code: string
  label: string
  price: number | null
  priceText: string | null
}

export type ServiceItem = {
  id: string
  code: string
  nameAr: string
  kbSlug: string | null
}

export type PriceItemData = {
  code: string
  name: string
  price: number | null
  priceText: string | null
  unit: string | null // "نبضة" renders as "X ج / نبضة"
  itemType: string
  groupName: string | null
  variant: string | null
  notes: string | null
}

// Resolved laser tables for the LSR category (single + 3-session + bundles).
export type LaserRow = {
  label: string
  single: number | null
  package3: number | null
  isBundle: boolean
}
export type LaserExtra = {
  code: string
  label: string
  unit: string | null
  price: number | null
  priceText: string | null
  isAddon: boolean
}
export type LaserTable = {
  women: LaserRow[]
  men: LaserRow[]
  extras: LaserExtra[] // pulse + prepaid packages + addons
}

export type PriceCategoryData = {
  code: string
  name: string
  startsFrom: number | null // "يبدأ من" (override, else cheapest service item)
  kbSlug: string | null
  sort: number
  items: PriceItemData[]
}

export type KbArticle = {
  slug: string
  title: string
  body: unknown
}

export type BranchData = {
  id: string
  code: string
  nameAr: string
  address: string | null
  paymentMethods: string[]
  hasTickets: boolean
  logoUrl: string | null
  doctors: DoctorData[]
  rooms: RoomInfo[]
  doctorUpdates: DoctorUpdate[]
  consultations: ConsultRow[]
  pulseFemale: number | null
  pulseMale: number | null
  services: ServiceItem[]
  priceCategories: PriceCategoryData[]
  laserTable: LaserTable | null
  kbArticles: KbArticle[]
}
