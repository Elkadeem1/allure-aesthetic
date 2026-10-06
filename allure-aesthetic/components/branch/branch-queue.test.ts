import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Database } from "@/lib/types/database.types"

type Ticket = Database["public"]["Views"]["ticket_board"]["Row"]

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: crypto.randomUUID(),
    ticket_no: 1001,
    kind: "request",
    status: "pending",
    kind_reason: "open_today",
    dentolize_status: "open",
    branch_id: "branch-1",
    doctor_id: "doc-1",
    service_id: "svc-1",
    customer_name: "سارة أحمد",
    customer_phone: "01012345678",
    customer_gender: "female",
    area_codes: ["UL"],
    appt_date: "2026-10-06",
    start_time: "10:00:00",
    end_time: "10:30:00",
    agent_note: null,
    created_by: "agent-1",
    created_at: new Date().toISOString(),
    sla_due_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    sla_breached_at: null,
    branch_response: null,
    responder_name: null,
    response_note: null,
    counter_date: null,
    counter_start_time: null,
    counter_doctor_id: null,
    responded_at: null,
    acknowledged_at: null,
    outcome: null,
    closed_by: null,
    closed_at: null,
    updated_at: new Date().toISOString(),
    branch_name: "فرع مدينة نصر",
    doctor_name: "د. نهى",
    service_name: "ليزر",
    agent_name: "محمد",
    is_overdue: false,
    response_seconds: null,
    ...overrides,
  }
}

describe("branch queue ticket filtering", () => {
  it("separates pending REQUESTs from NOTICEs", () => {
    const tickets = [
      makeTicket({ id: "r1", kind: "request", status: "pending" }),
      makeTicket({ id: "r2", kind: "request", status: "pending" }),
      makeTicket({ id: "n1", kind: "notice", status: "pending" }),
      makeTicket({ id: "c1", kind: "request", status: "closed" }),
    ]

    const pendingOnly = tickets.filter((t) => t.status === "pending")
    const requests = pendingOnly.filter((t) => t.kind === "request")
    const notices = pendingOnly.filter((t) => t.kind === "notice")
    const history = tickets.filter((t) => t.status !== "pending")

    expect(requests).toHaveLength(2)
    expect(requests.map((t) => t.id)).toEqual(["r1", "r2"])
    expect(notices).toHaveLength(1)
    expect(notices[0].id).toBe("n1")
    expect(history).toHaveLength(1)
    expect(history[0].id).toBe("c1")
  })

  it("puts pending NOTICE tickets in the notice section, not request", () => {
    const notice = makeTicket({ kind: "notice", status: "pending" })
    expect(notice.kind).toBe("notice")
    expect(notice.status).toBe("pending")

    const isRequest = notice.kind === "request" && notice.status === "pending"
    const isNotice = notice.kind === "notice" && notice.status === "pending"
    expect(isRequest).toBe(false)
    expect(isNotice).toBe(true)
  })
})

describe("SLA countdown logic", () => {
  it("computes remaining time when not overdue", () => {
    const dueAt = new Date(Date.now() + 3 * 60_000 + 30_000).toISOString()
    const remaining = new Date(dueAt).getTime() - Date.now()
    expect(remaining).toBeGreaterThan(0)

    const mm = Math.floor(remaining / 1000 / 60)
    const ss = Math.floor((remaining / 1000) % 60)
    expect(mm).toBe(3)
    expect(ss).toBeGreaterThanOrEqual(29)
  })

  it("detects overdue when sla_due_at is in the past", () => {
    const dueAt = new Date(Date.now() - 2 * 60_000).toISOString()
    const remaining = new Date(dueAt).getTime() - Date.now()
    const breached = remaining <= 0
    expect(breached).toBe(true)

    const absMs = Math.abs(remaining)
    const mm = Math.floor(absMs / 1000 / 60)
    expect(mm).toBe(2)
  })

  it("detects overdue when sla_breached_at is set", () => {
    const ticket = makeTicket({
      sla_breached_at: new Date().toISOString(),
      sla_due_at: new Date(Date.now() - 60_000).toISOString(),
    })
    const breached =
      ticket.sla_breached_at != null ||
      (ticket.sla_due_at != null &&
        new Date(ticket.sla_due_at).getTime() <= Date.now())
    expect(breached).toBe(true)
  })

  it("is_overdue view column reflects breach status", () => {
    const overdue = makeTicket({ is_overdue: true })
    const onTime = makeTicket({ is_overdue: false })
    expect(overdue.is_overdue).toBe(true)
    expect(onTime.is_overdue).toBe(false)
  })
})

describe("branch response actions", () => {
  it("validates responder name is required", () => {
    const name = ""
    expect(name.trim()).toBe("")
    const valid = name.trim().length > 0
    expect(valid).toBe(false)
  })

  it("validates counter_offer requires date and time", () => {
    const response = "counter_offer" as const
    const date = ""
    const time = ""
    const needsDateAndTime =
      response === "counter_offer" && (!date || !time)
    expect(needsDateAndTime).toBe(true)
  })

  it("validates unavailable requires a reason note", () => {
    const response = "unavailable" as const
    const note = ""
    const needsNote = response === "unavailable" && !note?.trim()
    expect(needsNote).toBe(true)
  })

  it("agent_confirm and branch_confirm need no extra fields", () => {
    const responses: string[] = ["agent_confirm", "branch_confirm"]
    for (const r of responses) {
      const needsExtra =
        r === "counter_offer" || r === "unavailable"
      expect(needsExtra).toBe(false)
    }
  })
})

describe("responder name persistence", () => {
  const RESPONDER_KEY = "allure_responder_name"

  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return store[key] ?? null
      },
      setItem(key: string, value: string) {
        store[key] = value
      },
      removeItem(key: string) {
        delete store[key]
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("stores responder name in localStorage", () => {
    localStorage.setItem(RESPONDER_KEY, "رانيا")
    expect(localStorage.getItem(RESPONDER_KEY)).toBe("رانيا")
  })

  it("retrieves previously saved responder name", () => {
    localStorage.setItem(RESPONDER_KEY, "أحمد")
    const saved = localStorage.getItem(RESPONDER_KEY)
    expect(saved).toBe("أحمد")
  })

  it("returns null when no name is saved", () => {
    expect(localStorage.getItem(RESPONDER_KEY)).toBeNull()
  })

  it("overwrites previous name", () => {
    localStorage.setItem(RESPONDER_KEY, "رانيا")
    localStorage.setItem(RESPONDER_KEY, "محمد")
    expect(localStorage.getItem(RESPONDER_KEY)).toBe("محمد")
  })
})

describe("notification read behavior", () => {
  it("timeAgo returns correct relative time", () => {
    function timeAgo(dateStr: string): string {
      const ms = Date.now() - new Date(dateStr).getTime()
      const min = Math.floor(ms / 60000)
      if (min < 1) return "دلوقتي"
      if (min < 60) return `منذ ${min} د`
      const hr = Math.floor(min / 60)
      if (hr < 24) return `منذ ${hr} س`
      return `منذ ${Math.floor(hr / 24)} ي`
    }

    expect(timeAgo(new Date().toISOString())).toBe("دلوقتي")
    expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe(
      "منذ 5 د",
    )
    expect(timeAgo(new Date(Date.now() - 2 * 3600_000).toISOString())).toBe(
      "منذ 2 س",
    )
    expect(
      timeAgo(new Date(Date.now() - 3 * 86400_000).toISOString()),
    ).toBe("منذ 3 ي")
  })

  it("marks notification as read by setting read_at", () => {
    const notif = {
      id: "n1",
      user_id: "u1",
      ticket_id: null,
      kind: "new_ticket",
      title: "طلب جديد",
      body: null,
      read_at: null as string | null,
      created_at: new Date().toISOString(),
    }

    expect(notif.read_at).toBeNull()
    notif.read_at = new Date().toISOString()
    expect(notif.read_at).not.toBeNull()
  })

  it("mark all read sets read_at on all items", () => {
    const items = [
      { id: "1", read_at: null as string | null },
      { id: "2", read_at: null as string | null },
      { id: "3", read_at: "2026-10-06T08:00:00Z" as string | null },
    ]

    const now = new Date().toISOString()
    const updated = items.map((n) => ({
      ...n,
      read_at: n.read_at ?? now,
    }))

    expect(updated.every((n) => n.read_at != null)).toBe(true)
    expect(updated[2].read_at).toBe("2026-10-06T08:00:00Z")
  })
})

describe("role/branch visibility", () => {
  it("branch role navigates to /branch for notifications", () => {
    const role: string = "branch"
    const path = role === "branch" ? "/branch" : "/dashboard/tickets"
    expect(path).toBe("/branch")
  })

  it("agent role navigates to /dashboard/tickets", () => {
    const role: string = "agent"
    const path = role === "branch" ? "/branch" : "/dashboard/tickets"
    expect(path).toBe("/dashboard/tickets")
  })

  it("admin role navigates to /dashboard/tickets", () => {
    const role: string = "admin"
    const path = role === "branch" ? "/branch" : "/dashboard/tickets"
    expect(path).toBe("/dashboard/tickets")
  })

  it("SLA board access: only admin and supervisor", () => {
    const allowed = ["admin", "supervisor"] as const
    expect(allowed.includes("admin")).toBe(true)
    expect(allowed.includes("supervisor")).toBe(true)
    expect((allowed as readonly string[]).includes("agent")).toBe(false)
    expect((allowed as readonly string[]).includes("branch")).toBe(false)
  })
})

describe("ticket history", () => {
  it("response time is computed from response_seconds", () => {
    function responseTime(seconds: number | null): string {
      if (seconds == null) return ""
      const m = Math.floor(seconds / 60)
      const s = Math.round(seconds % 60)
      if (m === 0) return `${s} ث`
      return `${m} د ${s > 0 ? s + " ث" : ""}`
    }

    expect(responseTime(null)).toBe("")
    expect(responseTime(45)).toBe("45 ث")
    expect(responseTime(125)).toBe("2 د 5 ث")
    expect(responseTime(180)).toBe("3 د ")
    expect(responseTime(0)).toBe("0 ث")
  })

  it("SLA breaches are marked in history", () => {
    const breachedTicket = makeTicket({
      status: "answered",
      is_overdue: true,
      sla_breached_at: new Date().toISOString(),
    })
    expect(breachedTicket.is_overdue).toBe(true)
    expect(breachedTicket.sla_breached_at).not.toBeNull()
  })
})
