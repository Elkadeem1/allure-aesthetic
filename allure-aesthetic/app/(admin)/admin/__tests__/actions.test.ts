import { describe, expect, it, vi, beforeEach } from "vitest"

const mockFrom = vi.fn()
const mockAuthGetUser = vi.fn()
const mockAdminCreateUser = vi.fn()
const mockAdminDeleteUser = vi.fn()
const mockAdminUpdateUserById = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockAuthGetUser },
    from: mockFrom,
  })),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockAdminCreateUser,
        deleteUser: mockAdminDeleteUser,
        updateUserById: mockAdminUpdateUserById,
      },
    },
    from: mockFrom,
  })),
}))

vi.mock("@/lib/booking/message", () => ({
  mapRpcError: (msg: string) => msg,
}))

import {
  createUserAction,
  updateUserAction,
  resetPasswordAction,
  createBranchAction,
  updateSlaMinutesAction,
  createServiceAction,
  createPriceListAction,
  saveDoctorScheduleAction,
} from "../actions"

function setupAdmin() {
  mockAuthGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } })
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { role: "admin" } }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "new-1" }, error: null }),
      }),
      error: null,
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ error: null }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ error: null }),
    }),
  })
}

function setupNonAdmin() {
  mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { role: "agent" } }),
      }),
    }),
  })
}

function setupUnauthenticated() {
  mockAuthGetUser.mockResolvedValue({ data: { user: null } })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("requireAdmin guard", () => {
  it("rejects unauthenticated users", async () => {
    setupUnauthenticated()
    const res = await createBranchAction({ code: "BR1", nameAr: "فرع", address: null, paymentMethods: [], priceListId: null })
    expect(res).toEqual({ ok: false, error: "مش مسجل دخول." })
  })

  it("rejects non-admin users", async () => {
    setupNonAdmin()
    const res = await createBranchAction({ code: "BR1", nameAr: "فرع", address: null, paymentMethods: [], priceListId: null })
    expect(res).toEqual({ ok: false, error: "غير مصرح." })
  })
})

// ---------------------------------------------------------------------------
// User actions — validation
// ---------------------------------------------------------------------------

describe("createUserAction — validation", () => {
  beforeEach(setupAdmin)

  it("rejects empty email", async () => {
    const res = await createUserAction({ email: "", password: "123456", fullName: "Test", role: "agent", branchId: null })
    expect(res).toEqual({ ok: false, error: "كل الحقول مطلوبة." })
  })

  it("rejects short password", async () => {
    const res = await createUserAction({ email: "x@y.com", password: "12345", fullName: "Test", role: "agent", branchId: null })
    expect(res).toEqual({ ok: false, error: "كلمة المرور لازم تكون 6 حروف على الأقل." })
  })

  it("rejects branch user without branchId", async () => {
    const res = await createUserAction({ email: "x@y.com", password: "123456", fullName: "Test", role: "branch", branchId: null })
    expect(res).toEqual({ ok: false, error: "مستخدم الفرع لازم يكون مرتبط بفرع." })
  })

  it("rejects non-branch user with branchId", async () => {
    const res = await createUserAction({ email: "x@y.com", password: "123456", fullName: "Test", role: "agent", branchId: "br-1" })
    expect(res).toEqual({ ok: false, error: "المستخدم مش فرع — مينفعش يكون مرتبط بفرع." })
  })
})

describe("updateUserAction — validation", () => {
  beforeEach(setupAdmin)

  it("rejects branch role without branchId", async () => {
    const res = await updateUserAction({ userId: "u-1", fullName: "Test", role: "branch", branchId: null, isActive: true })
    expect(res).toEqual({ ok: false, error: "مستخدم الفرع لازم يكون مرتبط بفرع." })
  })

  it("rejects non-branch role with branchId", async () => {
    const res = await updateUserAction({ userId: "u-1", fullName: "Test", role: "admin", branchId: "br-1", isActive: true })
    expect(res).toEqual({ ok: false, error: "المستخدم مش فرع — مينفعش يكون مرتبط بفرع." })
  })
})

describe("resetPasswordAction — validation", () => {
  beforeEach(setupAdmin)

  it("rejects short new password", async () => {
    const res = await resetPasswordAction({ userId: "u-1", newPassword: "12345" })
    expect(res).toEqual({ ok: false, error: "كلمة المرور لازم تكون 6 حروف على الأقل." })
  })
})

// ---------------------------------------------------------------------------
// Branch actions — validation
// ---------------------------------------------------------------------------

describe("createBranchAction — validation", () => {
  beforeEach(setupAdmin)

  it("rejects empty code", async () => {
    const res = await createBranchAction({ code: "", nameAr: "فرع", address: null, paymentMethods: [], priceListId: null })
    expect(res).toEqual({ ok: false, error: "الكود والاسم مطلوبين." })
  })

  it("rejects empty name", async () => {
    const res = await createBranchAction({ code: "BR1", nameAr: "", address: null, paymentMethods: [], priceListId: null })
    expect(res).toEqual({ ok: false, error: "الكود والاسم مطلوبين." })
  })
})

// ---------------------------------------------------------------------------
// Service actions — validation
// ---------------------------------------------------------------------------

describe("createServiceAction — validation", () => {
  beforeEach(setupAdmin)

  it("rejects empty code", async () => {
    const res = await createServiceAction({
      code: "", nameAr: "خدمة", nameEn: "Service", defaultDuration: 30,
      usesLaser: false, kbSlug: null,
    })
    expect(res).toEqual({ ok: false, error: "الكود والاسم مطلوبين." })
  })
})

// ---------------------------------------------------------------------------
// Price list actions — validation
// ---------------------------------------------------------------------------

describe("createPriceListAction — validation", () => {
  beforeEach(setupAdmin)

  it("rejects empty code", async () => {
    const res = await createPriceListAction({ code: "", name: "list" })
    expect(res).toEqual({ ok: false, error: "الكود والاسم مطلوبين." })
  })
})

// ---------------------------------------------------------------------------
// SLA setting — validation
// ---------------------------------------------------------------------------

describe("updateSlaMinutesAction — validation", () => {
  beforeEach(setupAdmin)

  it("rejects value below 1", async () => {
    const res = await updateSlaMinutesAction(0)
    expect(res).toEqual({ ok: false, error: "SLA لازم تكون بين 1 و 120 دقيقة." })
  })

  it("rejects value above 120", async () => {
    const res = await updateSlaMinutesAction(121)
    expect(res).toEqual({ ok: false, error: "SLA لازم تكون بين 1 و 120 دقيقة." })
  })
})

// ---------------------------------------------------------------------------
// Doctor schedule — validation
// ---------------------------------------------------------------------------

describe("saveDoctorScheduleAction — validation", () => {
  beforeEach(setupAdmin)

  it("rejects weekday out of 0-6 range", async () => {
    const res = await saveDoctorScheduleAction({
      doctorId: "d-1",
      entries: [{ weekday: 7, startTime: "09:00", endTime: "17:00", shiftKind: "morning" }],
    })
    expect(res).toEqual({ ok: false, error: "يوم غير صحيح." })
  })

  it("rejects start_time >= end_time", async () => {
    const res = await saveDoctorScheduleAction({
      doctorId: "d-1",
      entries: [{ weekday: 0, startTime: "17:00", endTime: "09:00", shiftKind: "morning" }],
    })
    expect(res).toEqual({ ok: false, error: "وقت البداية لازم يكون قبل وقت النهاية." })
  })
})
