import { describe, expect, it } from "vitest"
import { decisionCardCopy } from "../message"

describe("decisionCardCopy — SLA text", () => {
  it("uses the configured SLA minutes for requests", () => {
    expect(decisionCardCopy("request", 5).instruction).toContain("خلال 5 دقايق")
    expect(decisionCardCopy("request", 10).instruction).toContain("خلال 10 دقايق")
  })

  it("notice and no-ticket copy do not mention the SLA", () => {
    expect(decisionCardCopy("notice", 10).instruction).not.toContain("دقايق")
    expect(decisionCardCopy(null, 10).instruction).not.toContain("دقايق")
  })
})
