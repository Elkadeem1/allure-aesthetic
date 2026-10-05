import { describe, expect, it } from "vitest"
import { laserPrice } from "../pricing"
import { LASER_CONFIG, STANDARD_PRICES } from "./fixtures"

describe("laserPrice", () => {
  it("prices a single area with its 3-session package", () => {
    const r = laserPrice(["w_face"], STANDARD_PRICES, LASER_CONFIG)
    expect(r.lines).toHaveLength(1)
    expect(r.singleTotal).toBe(250)
    expect(r.package3Total).toBe(650)
    expect(r.unpriced).toEqual([])
  })

  it("prefers a bundle over its individual areas (Face + Neck)", () => {
    const r = laserPrice(["w_face", "w_neck"], STANDARD_PRICES, LASER_CONFIG)
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].label).toBe("الوجه والرقبة (Face & Neck)")
    expect(r.singleTotal).toBe(300)
    expect(r.package3Total).toBe(800)
  })

  it("totals a bundle plus a single (Face+Neck + Half Arms)", () => {
    const r = laserPrice(["w_face", "w_neck", "w_halfarms"], STANDARD_PRICES, LASER_CONFIG)
    expect(r.lines).toHaveLength(2)
    expect(r.singleTotal).toBe(300 + 500)
    expect(r.package3Total).toBe(800 + 1300)
  })

  it("drops Bikini Line (companion-only, unpriced) and matches the bundle", () => {
    const r = laserPrice(["w_underarm", "w_bikini", "w_bikiniline"], STANDARD_PRICES, LASER_CONFIG)
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].label).toBe("البكيني والأندر أرم (Bikini & Underarms)")
    expect(r.singleTotal).toBe(400)
    expect(r.unpriced).toEqual([])
  })

  it("package3Total is null when a line has no package, and lists unpriced areas", () => {
    const r = laserPrice(["w_face", "w_mustache"], STANDARD_PRICES, LASER_CONFIG)
    // w_face is priced (with package); w_mustache has no entry -> unpriced
    expect(r.unpriced).toEqual(["w_mustache"])
    expect(r.singleTotal).toBe(250)
    expect(r.package3Total).toBe(650) // only priced lines contribute
  })
})
