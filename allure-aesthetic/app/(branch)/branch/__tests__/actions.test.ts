import { describe, expect, it, vi, beforeEach } from "vitest"

const mockRpc = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mockRpc })),
}))

vi.mock("@/lib/time", () => ({
  cairoToday: () => "2026-10-07",
}))

import { branchRespondAction } from "../actions"

const counter = (counterDate: string, counterStartTime = "14:30:00") => ({
  ticketId: "t-1",
  response: "counter_offer" as const,
  responderName: "منى",
  counterDate,
  counterStartTime,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockRpc.mockResolvedValue({ error: null })
})

describe("branchRespondAction — counter-offer validation", () => {
  it("rejects a counter-offer date in the past (Cairo)", async () => {
    const res = await branchRespondAction(counter("2026-10-06"))
    expect(res).toEqual({ ok: false, error: "الميعاد البديل لازم يكون النهاردة أو بعد كده." })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects a malformed or impossible date", async () => {
    for (const d of ["07/10/2026", "2026-02-30", "2026-13-01"]) {
      const res = await branchRespondAction(counter(d))
      expect(res).toEqual({ ok: false, error: "التاريخ أو الوقت مش صحيح." })
    }
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects a malformed time", async () => {
    const res = await branchRespondAction(counter("2026-10-08", "25:00:00"))
    expect(res).toEqual({ ok: false, error: "التاريخ أو الوقت مش صحيح." })
  })

  it("accepts today and future dates", async () => {
    for (const d of ["2026-10-07", "2026-10-20"]) {
      const res = await branchRespondAction(counter(d))
      expect(res).toEqual({ ok: true })
    }
    expect(mockRpc).toHaveBeenCalledTimes(2)
  })

  it("does not apply date checks to non-counter responses", async () => {
    const res = await branchRespondAction({
      ticketId: "t-1",
      response: "agent_confirm",
      responderName: "منى",
    })
    expect(res).toEqual({ ok: true })
  })
})
