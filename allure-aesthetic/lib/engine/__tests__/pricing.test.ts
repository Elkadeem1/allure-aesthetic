import { describe, expect, it } from "vitest"
import {
  categoryStartsFrom,
  consultationCard,
  laserAreaPricing,
  laserPrice,
  pulsePrice,
} from "../pricing"
import {
  INNOVA_BOOK,
  KAFR_BOOK,
  KHOLOUD,
  LASER_CONFIG,
  STANDARD_BOOK,
  STANDARD_PRICES,
} from "./fixtures"

describe("laserPrice (resolved entries)", () => {
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

  it("drops Bikini Line (companion-only) and matches the bundle", () => {
    const r = laserPrice(["w_underarm", "w_bikini", "w_bikiniline"], STANDARD_PRICES, LASER_CONFIG)
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].label).toBe("البكيني والأندر أرم (Bikini & Underarms)")
    expect(r.singleTotal).toBe(400)
    expect(r.unpriced).toEqual([])
  })
})

describe("pulsePrice (LSR-21 women / LSR-40 men)", () => {
  it("reads the branch pulse price per gender", () => {
    expect(pulsePrice(STANDARD_BOOK, "female")).toBe(1)
    expect(pulsePrice(STANDARD_BOOK, "male")).toBe(2)
  })
  it("is null when the branch has no pulse item", () => {
    expect(pulsePrice(KAFR_BOOK, "female")).toBeNull()
  })
})

describe("categoryStartsFrom (يبدأ من)", () => {
  it("uses the admin override (Dermapen = 750) even when items cost more", () => {
    expect(categoryStartsFrom(STANDARD_BOOK, "DPN")).toBe(750)
  })
  it("else uses the cheapest service item, ignoring addons and 0-priced", () => {
    // FIL has a 1200 service, a 50 addon, and a 0-priced service -> 1200.
    expect(categoryStartsFrom(STANDARD_BOOK, "FIL")).toBe(1200)
  })
  it("returns null for an unknown category", () => {
    expect(categoryStartsFrom(STANDARD_BOOK, "ZZZ")).toBeNull()
  })
})

describe("consultationCard (CON items + per-doctor rows)", () => {
  it("shows CON-01..04 for any doctor in a standard branch", () => {
    const card = consultationCard(STANDARD_BOOK)
    expect(card.map((c) => c.code)).toEqual(["CON-01", "CON-02", "CON-03", "CON-04"])
  })

  it("adds the Kafr doctor-specific rows only for a linked doctor", () => {
    const forKholoud = consultationCard(KAFR_BOOK, KHOLOUD.id)
    expect(forKholoud.map((c) => c.code)).toContain("CON-05")
    expect(forKholoud.map((c) => c.code)).toContain("CON-06")

    const forOther = consultationCard(KAFR_BOOK, "someone-else")
    expect(forOther.map((c) => c.code)).toEqual(["CON-01", "CON-02"])
  })

  it("surfaces the Innova Re Cons textual price", () => {
    const card = consultationCard(INNOVA_BOOK)
    const reCons = card.find((c) => c.code === "INV-029")
    expect(reCons?.price).toBeNull()
    expect(reCons?.priceText).toBe("مجاني خلال شهر")
  })
})

describe("laserAreaPricing (per-branch, bundle-first, never invents a price)", () => {
  it("prices a bundle (Face + Neck) with its package", () => {
    const r = laserAreaPricing(["w_face", "w_neck"], "female", STANDARD_BOOK, LASER_CONFIG)
    expect(r.lines).toHaveLength(1)
    expect(r.singleTotal).toBe(300)
    expect(r.package3Total).toBe(800)
    expect(r.noStandalone).toEqual([])
  })

  it("an area with no standalone price returns the containing bundle + pulse", () => {
    const r = laserAreaPricing(["w_bikini"], "female", STANDARD_BOOK, LASER_CONFIG)
    expect(r.lines).toEqual([])
    expect(r.noStandalone).toHaveLength(1)
    expect(r.noStandalone[0].areaCode).toBe("w_bikini")
    expect(r.noStandalone[0].bundle?.label).toBe("البكيني والأندر أرم (Bikini & Underarms)")
    expect(r.noStandalone[0].pulse).toBe(1)
  })

  it("men single with no 3-session package -> package3Total null", () => {
    const r = laserAreaPricing(["m_upper"], "male", STANDARD_BOOK, LASER_CONFIG)
    expect(r.singleTotal).toBe(120)
    expect(r.package3Total).toBeNull()
    expect(r.noStandalone).toEqual([])
  })
})
