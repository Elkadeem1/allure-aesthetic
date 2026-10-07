import { describe, expect, it, vi, beforeEach } from "vitest"

// Mock Supabase before importing actions
const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockAuthGetUser = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockAuthGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}))

vi.mock("@/lib/booking/message", () => ({
  mapRpcError: (msg: string) => msg,
}))

import {
  createDoctorUpdateAction,
  deleteDoctorUpdateAction,
  saveScheduleAction,
} from "../actions"

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
  mockRpc.mockResolvedValue({ error: null })
  mockFrom.mockReturnValue({
    insert: mockInsert.mockReturnValue({ error: null }),
    delete: mockDelete.mockReturnValue({
      eq: vi.fn().mockReturnValue({ error: null }),
    }),
  })
})

describe("createDoctorUpdateAction — validation", () => {
  const base = {
    branchId: "br-1",
    doctorId: "doc-1",
    type: "off" as const,
    dateFrom: "2026-10-07",
    dateTo: "2026-10-07",
  }

  it("rejects empty dateFrom", async () => {
    const res = await createDoctorUpdateAction({ ...base, dateFrom: "" })
    expect(res).toEqual({ ok: false, error: "لازم تحدد التاريخ." })
  })

  it("rejects dateFrom > dateTo", async () => {
    const res = await createDoctorUpdateAction({
      ...base,
      dateFrom: "2026-10-08",
      dateTo: "2026-10-07",
    })
    expect(res).toEqual({
      ok: false,
      error: "تاريخ البداية لازم يكون قبل أو يساوي تاريخ النهاية.",
    })
  })

  it("rejects hours type without segments", async () => {
    const res = await createDoctorUpdateAction({
      ...base,
      type: "hours",
      segments: [],
    })
    expect(res).toEqual({ ok: false, error: "لازم تحدد ساعات العمل." })
  })

  it("rejects hours segment with start >= end", async () => {
    const res = await createDoctorUpdateAction({
      ...base,
      type: "hours",
      segments: [{ start: "16:00", end: "10:00" }],
    })
    expect(res).toEqual({
      ok: false,
      error: "وقت البداية لازم يكون قبل وقت النهاية.",
    })
  })

  it("rejects overlapping hours segments", async () => {
    const res = await createDoctorUpdateAction({
      ...base,
      type: "hours",
      segments: [
        { start: "10:00", end: "14:00" },
        { start: "13:00", end: "17:00" },
      ],
    })
    expect(res).toEqual({ ok: false, error: "الفترات متداخلة — راجعها." })
  })

  it("accepts non-overlapping hours segments", async () => {
    mockFrom.mockReturnValue({
      insert: mockInsert.mockReturnValue({ error: null }),
    })
    const res = await createDoctorUpdateAction({
      ...base,
      type: "hours",
      segments: [
        { start: "10:00", end: "14:00" },
        { start: "14:00", end: "17:00" },
      ],
    })
    expect(res).toEqual({ ok: true })
  })

  it("rejects note type without note text", async () => {
    const res = await createDoctorUpdateAction({
      ...base,
      type: "note",
      note: "  ",
    })
    expect(res).toEqual({ ok: false, error: "لازم تكتب الملاحظة." })
  })

  it("rejects branch-wide updates with doctor-only types", async () => {
    for (const type of ["hours", "open_slot", "force_open"] as const) {
      const res = await createDoctorUpdateAction({
        ...base,
        doctorId: null,
        type,
      })
      expect(res.ok).toBe(false)
    }
  })

  it("allows branch-wide off, stop, note types", async () => {
    for (const type of ["off", "stop"] as const) {
      mockFrom.mockReturnValue({
        insert: mockInsert.mockReturnValue({ error: null }),
      })
      const res = await createDoctorUpdateAction({
        ...base,
        doctorId: null,
        type,
      })
      expect(res).toEqual({ ok: true })
    }
  })

  it("rejects if not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } })
    mockFrom.mockReturnValue({
      insert: mockInsert.mockReturnValue({ error: null }),
    })
    const res = await createDoctorUpdateAction(base)
    expect(res).toEqual({ ok: false, error: "مش مسجل دخول." })
  })
})

describe("saveScheduleAction — validation", () => {
  const entry = (weekday: number, start: string, end: string) => ({
    doctorId: "doc-1",
    weekday,
    startTime: start,
    endTime: end,
    kind: "all" as const,
  })

  it("rejects weekday out of range (Sat=0 .. Fri=6)", async () => {
    const res = await saveScheduleAction({
      doctorId: "doc-1",
      entries: [entry(7, "10:00", "16:00")],
    })
    expect(res).toEqual({ ok: false, error: "يوم غير صحيح." })
  })

  it("rejects negative weekday", async () => {
    const res = await saveScheduleAction({
      doctorId: "doc-1",
      entries: [entry(-1, "10:00", "16:00")],
    })
    expect(res).toEqual({ ok: false, error: "يوم غير صحيح." })
  })

  it("rejects start >= end", async () => {
    const res = await saveScheduleAction({
      doctorId: "doc-1",
      entries: [entry(0, "16:00", "10:00")],
    })
    expect(res).toEqual({
      ok: false,
      error: "وقت البداية لازم يكون قبل وقت النهاية.",
    })
  })

  it("rejects overlapping shifts on same weekday", async () => {
    const res = await saveScheduleAction({
      doctorId: "doc-1",
      entries: [
        entry(0, "10:00", "14:00"),
        entry(0, "13:00", "17:00"),
      ],
    })
    expect(res).toEqual({
      ok: false,
      error: "فترات متداخلة في نفس اليوم — راجع الجدول.",
    })
  })

  it("accepts adjacent shifts on same weekday", async () => {
    const res = await saveScheduleAction({
      doctorId: "doc-1",
      entries: [
        entry(0, "10:00", "14:00"),
        entry(0, "14:00", "18:00"),
      ],
    })
    expect(res).toEqual({ ok: true })
  })

  it("validates Saturday=0 through Friday=6 range", async () => {
    const res = await saveScheduleAction({
      doctorId: "doc-1",
      entries: [
        entry(0, "10:00", "16:00"), // Saturday
        entry(6, "10:00", "16:00"), // Friday
      ],
    })
    expect(res).toEqual({ ok: true })
  })

  it("saves empty schedule (clears all shifts)", async () => {
    const res = await saveScheduleAction({
      doctorId: "doc-1",
      entries: [],
    })
    expect(res).toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith("replace_doctor_schedule", {
      p_doctor_id: "doc-1",
      p_entries: [],
    })
  })

  it("saves delete + insert atomically through one RPC call", async () => {
    const res = await saveScheduleAction({
      doctorId: "doc-1",
      entries: [entry(0, "10:00", "14:00"), entry(2, "15:00", "20:00")],
    })
    expect(res).toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith("replace_doctor_schedule", {
      p_doctor_id: "doc-1",
      p_entries: [
        { weekday: 0, start_time: "10:00", end_time: "14:00", kind: "all" },
        { weekday: 2, start_time: "15:00", end_time: "20:00", kind: "all" },
      ],
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("returns the RPC error (schedule left untouched by rollback)", async () => {
    mockRpc.mockResolvedValue({ error: { message: "not_allowed" } })
    const res = await saveScheduleAction({
      doctorId: "doc-other-branch",
      entries: [entry(0, "10:00", "14:00")],
    })
    expect(res).toEqual({ ok: false, error: "not_allowed" })
  })
})

describe("deleteDoctorUpdateAction", () => {
  const mockDeleteResult = (result: { data: unknown; error: unknown }) => {
    const select = vi.fn().mockResolvedValue(result)
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select }) }),
    })
  }

  it("returns ok on success", async () => {
    mockDeleteResult({ data: [{ id: "upd-1" }], error: null })
    const res = await deleteDoctorUpdateAction("upd-1")
    expect(res).toEqual({ ok: true })
  })

  it("rejects if not authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } })
    const res = await deleteDoctorUpdateAction("upd-1")
    expect(res).toEqual({ ok: false, error: "مش مسجل دخول." })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("reports not allowed when RLS filters the row out (0 rows deleted)", async () => {
    mockDeleteResult({ data: [], error: null })
    const res = await deleteDoctorUpdateAction("upd-other-branch")
    expect(res).toEqual({ ok: false, error: "not_allowed" })
  })

  it("returns error on failure", async () => {
    mockDeleteResult({ data: null, error: { message: "RLS violation" } })
    const res = await deleteDoctorUpdateAction("upd-1")
    expect(res).toEqual({ ok: false, error: "RLS violation" })
  })
})
