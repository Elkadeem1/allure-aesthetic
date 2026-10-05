"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { toZonedTime } from "date-fns-tz"

function getDisplay() {
  const now = toZonedTime(new Date(), "Africa/Cairo")
  const h = now.getHours()
  const m = now.getMinutes()
  const ampm = h >= 12 ? "م" : "ص"
  const h12 = h % 12 || 12
  const time = `${h12.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${ampm}`
  const date = format(now, "EEEE، d MMMM", { locale: ar })
  return { time, date }
}

export function CairoClock() {
  const [display, setDisplay] = useState(getDisplay)

  useEffect(() => {
    const tick = () => setDisplay(getDisplay())
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="text-left" dir="ltr">
      <div className="text-sm font-bold tabular text-foreground leading-tight">
        {display.time}
      </div>
      <div className="text-[11px] text-muted-foreground leading-tight">
        {display.date}
      </div>
    </div>
  )
}
