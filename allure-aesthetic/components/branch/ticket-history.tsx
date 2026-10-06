"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, AlertTriangle, Clock } from "lucide-react"
import { cn } from "cn"
import { formatNumber, formatTime } from "@/lib/format"
import type { Database, BranchResponse } from "@/lib/types/database.types"

type Ticket = Database["public"]["Views"]["ticket_board"]["Row"]

const RESPONSE_LABELS: Record<BranchResponse, string> = {
  agent_confirm: "أكدوا إنتوا",
  branch_confirm: "إحنا هنأكد",
  counter_offer: "ميعاد بديل",
  unavailable: "مش متاح",
}

function hhmm(t: string | null): string {
  return t ? formatTime(t.slice(0, 5)) : ""
}

function ddmm(date: string | null): string {
  if (!date) return ""
  const [, m, d] = date.split("-")
  return `${d}/${m}`
}

function responseTime(seconds: number | null): string {
  if (seconds == null) return ""
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m === 0) return `${s} ث`
  return `${m} د ${s > 0 ? s + " ث" : ""}`
}

export function TicketHistory({ tickets }: { tickets: Ticket[] }) {
  const [open, setOpen] = useState(false)

  if (tickets.length === 0) return null

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        سجل النهاردة ({formatNumber(tickets.length)})
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-foreground truncate">
                    {t.customer_name}
                  </span>
                  <span className="text-muted-foreground">&middot;</span>
                  <span className="text-muted-foreground truncate">
                    {t.doctor_name}
                  </span>
                  <span className="text-muted-foreground tabular">
                    {ddmm(t.appt_date)} {hhmm(t.start_time)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="tabular">
                    تيكت #{formatNumber(t.ticket_no!)}
                  </span>
                  {t.branch_response && (
                    <>
                      <span>&middot;</span>
                      <span>{RESPONSE_LABELS[t.branch_response]}</span>
                    </>
                  )}
                  {t.responder_name && (
                    <>
                      <span>&middot;</span>
                      <span>{t.responder_name}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {t.response_seconds != null && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={12} />
                    <span className="tabular">{responseTime(t.response_seconds)}</span>
                  </div>
                )}
                {t.is_overdue && (
                  <div
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                      "bg-[var(--status-breach-bg)] text-[var(--status-breach)]",
                    )}
                  >
                    <AlertTriangle size={12} />
                    متأخر
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
