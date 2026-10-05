import { describe, expect, it } from "vitest"
import { cairoDateOf, cairoDayRange } from "../time"

describe("cairoDayRange — Cairo day bounds as UTC instants", () => {
  // Cairo is UTC+2 in winter; midnight maps to 22:00 UTC the previous day.
  it("maps a Cairo date to the correct UTC window (winter / UTC+2)", () => {
    const r = cairoDayRange("2026-01-15")
    expect(r.dateStr).toBe("2026-01-15")
    expect(r.startUtc).toBe("2026-01-14T22:00:00.000Z")
    expect(r.endUtc).toBe("2026-01-15T22:00:00.000Z")
  })

  it("00:30 Cairo belongs to that Cairo day (not the previous UTC day)", () => {
    // 00:30 Cairo on 2026-01-15 == 22:30 UTC on 2026-01-14
    const instant = new Date("2026-01-14T22:30:00.000Z")
    expect(cairoDateOf(instant)).toBe("2026-01-15")

    const r = cairoDayRange("2026-01-15")
    const iso = instant.toISOString()
    expect(iso >= r.startUtc && iso < r.endUtc).toBe(true) // inside today
  })

  it("23:30 Cairo still belongs to the same Cairo day", () => {
    // 23:30 Cairo on 2026-01-15 == 21:30 UTC on 2026-01-15
    const instant = new Date("2026-01-15T21:30:00.000Z")
    expect(cairoDateOf(instant)).toBe("2026-01-15")

    const r = cairoDayRange("2026-01-15")
    const iso = instant.toISOString()
    expect(iso >= r.startUtc && iso < r.endUtc).toBe(true)
  })

  it("the midnight boundary flips the Cairo date", () => {
    expect(cairoDateOf(new Date("2026-01-14T21:59:59.000Z"))).toBe("2026-01-14") // 23:59:59 Cairo
    expect(cairoDateOf(new Date("2026-01-14T22:00:00.000Z"))).toBe("2026-01-15") // 00:00:00 Cairo
  })

  it("regression: a 01:10 Cairo ticket is inside today's range (the reported bug)", () => {
    // DST window (Oct 2026, UTC+3): 01:10 Cairo on Oct 6 == 22:10 UTC on Oct 5.
    const created = new Date("2026-10-05T22:10:00.000Z")
    expect(cairoDateOf(created)).toBe("2026-10-06")

    const r = cairoDayRange("2026-10-06")
    const iso = created.toISOString()
    expect(iso >= r.startUtc && iso < r.endUtc).toBe(true)
    // the naive (buggy) boundary would have been 2026-10-06T00:00:00Z, which excludes it
    expect(iso < "2026-10-06T00:00:00.000Z").toBe(true)
  })
})
