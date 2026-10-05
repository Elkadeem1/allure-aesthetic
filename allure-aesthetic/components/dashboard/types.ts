export type DoctorScheduleEntry = {
  id: string
  weekday: number  // 0=Sat … 6=Fri
  startTime: string
  endTime: string
  kind: string
}

export type DoctorUpdate = {
  id: string
  doctorId: string | null
  type: string  // off | stop | hours | open_slot | note
  dateFrom: string
  dateTo: string
  note: string | null
  segments: Array<{ start: string; end: string; kind?: string }>
}

export type DoctorData = {
  id: string
  displayName: string
  notes: string | null
  sort: number
  schedules: DoctorScheduleEntry[]
}

export type ConsultationPrice = {
  kind: string
  price: number
  doctorId: string | null
  doctorName?: string
}

export type ServiceItem = {
  id: string
  code: string
  nameAr: string
  kbSlug: string | null
}

export type PriceItemData = {
  id: string
  name: string
  price: number | null
  priceText: string | null
  sort: number
}

export type PriceCategoryData = {
  id: string
  name: string
  infoNote: string | null
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
  nameAr: string
  address: string | null
  paymentMethods: string[]
  bookingRules: string[]
  doctors: DoctorData[]
  doctorUpdates: DoctorUpdate[]
  consultationPrices: ConsultationPrice[]
  services: ServiceItem[]
  priceCategories: PriceCategoryData[]
  kbArticles: KbArticle[]
}
