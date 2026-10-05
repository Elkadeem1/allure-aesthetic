import { describe, expect, it } from "vitest"
import { areasFor, companionMissing, laserMinutes, sessionMinutes, toggleArea } from "../areas"
import { CONSULT, LASER, LASER_CONFIG } from "./fixtures"

describe("areasFor", () => {
  it("returns only the areas for the chosen gender", () => {
    const women = areasFor("female", LASER_CONFIG.areas)
    const men = areasFor("male", LASER_CONFIG.areas)
    expect(women.every((a) => a.gender === "female")).toBe(true)
    expect(men.every((a) => a.gender === "male")).toBe(true)
    expect(women.map((a) => a.code)).toContain("w_bikiniline")
    expect(men.map((a) => a.code)).toContain("m_beard")
  })
})

describe("toggleArea", () => {
  it("half <-> full are mutually exclusive", () => {
    let sel = toggleArea([], "w_halfarms", LASER_CONFIG)
    expect(sel).toEqual(["w_halfarms"])
    sel = toggleArea(sel, "w_fullarms", LASER_CONFIG) // picking full removes half
    expect(sel).toEqual(["w_fullarms"])
    sel = toggleArea(sel, "w_halfarms", LASER_CONFIG) // and back
    expect(sel).toEqual(["w_halfarms"])
  })

  it("full legs removes both half-leg selections", () => {
    const sel = toggleArea(["w_halflegup", "w_halflegdn", "w_face"], "w_fulllegs", LASER_CONFIG)
    expect(sel).toEqual(["w_face", "w_fulllegs"])
  })

  it("full body excludes every other area, and vice-versa", () => {
    const sel = toggleArea(["w_face", "w_halfarms"], "w_fb", LASER_CONFIG)
    expect(sel).toEqual(["w_fb"])
    // selecting a normal area after full body drops the full body
    const next = toggleArea(sel, "w_face", LASER_CONFIG)
    expect(next).toEqual(["w_face"])
  })

  it("toggling an already-selected area removes it", () => {
    expect(toggleArea(["w_face", "w_neck"], "w_face", LASER_CONFIG)).toEqual(["w_neck"])
  })
})

describe("companionMissing (Bikini Line never alone)", () => {
  it("rejects Bikini Line on its own", () => {
    expect(companionMissing(["w_bikiniline"], LASER_CONFIG.areas)).toBe(true)
  })
  it("accepts Bikini Line with another area", () => {
    expect(companionMissing(["w_bikiniline", "w_bikini"], LASER_CONFIG.areas)).toBe(false)
  })
})

describe("sessionMinutes", () => {
  it("Half Arms + Half Leg = 30 (combo subtracts 30 from 60)", () => {
    const { total, adjustments } = laserMinutes(["w_halfarms", "w_halflegup"], LASER_CONFIG)
    expect(total).toBe(30)
    expect(adjustments).toContain("كومبو Half-Legs + Half-Arms = ٣٠ دقيقة")
    expect(sessionMinutes(LASER, ["w_halfarms", "w_halflegup"], LASER_CONFIG)).toBe(30)
  })

  it("plain sum when no combo applies", () => {
    expect(sessionMinutes(LASER, ["w_face", "w_neck"], LASER_CONFIG)).toBe(30) // 15 + 15
  })

  it("non-laser services are a fixed 30 minutes", () => {
    expect(sessionMinutes(CONSULT, [], LASER_CONFIG)).toBe(30)
  })
})
