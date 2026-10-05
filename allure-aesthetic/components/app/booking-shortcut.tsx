"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Ctrl/Cmd+B anywhere in the agent app opens the booking wizard, preselecting
 * the last branch the agent viewed (persisted by the dashboard branch tabs).
 */
export function BookingShortcut() {
  const router = useRouter()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault()
        let href = "/dashboard/book"
        try {
          const last = localStorage.getItem("allure.lastBranchId")
          if (last) href += `?branch=${encodeURIComponent(last)}`
        } catch {
          /* ignore */
        }
        router.push(href)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])
  return null
}
