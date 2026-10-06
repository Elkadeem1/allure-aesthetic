"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Timer } from "lucide-react"
import { cn } from "cn"
import { createClient } from "@/lib/supabase/client"
import { formatNumber, formatTime } from "@/lib/format"
import type { Database } from "@/lib/types/database.types"

type Ticket = Database["public"]["Views"]["ticket_board"]["Row"]

function hhmm(t: string | null): string {
  return t ? formatTime(t.slice(0, 5)) : ""
}

function ddmm(date: string | null): string {
  if (!date) return ""
  const [, m, d] = date.split("-")
  return `${d}/${m}`
}

function SlaCountdown({ dueAt, breachedAt }: { dueAt: string; breachedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remaining = new Date(dueAt).getTime() - now
  const breached = breachedAt != null || remaining <= 0
  const absMs = Math.abs(remaining)
  const mm = Math.floor(absMs / 1000 / 60)
  const ss = Math.floor((absMs / 1000) % 60)
  const display = `${mm}:${ss.toString().padStart(2, "0")}`

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold tabular",
        breached
          ? "animate-sla-pulse bg-[var(--status-breach-bg)] text-[var(--status-breach)]"
          : "bg-[var(--status-request-bg)] text-[var(--status-request)]",
      )}
    >
      {breached ? <AlertTriangle size={12} /> : <Timer size={12} />}
      {breached ? `متأخر ${display}` : `باقي ${display}`}
    </span>
  )
}

export function SlaBoard({ initialTickets }: { initialTickets: Ticket[] }) {
  const [tickets, setTickets] = useState(initialTickets)
  const supabase = useMemo(() => createClient(), [])

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("ticket_board")
      .select("*")
      .eq("kind", "request")
      .eq("status", "pending")
      .order("sla_due_at", { ascending: true })
    if (data) setTickets(data)
  }, [supabase])

  useEffect(() => {
    const channel = supabase
      .channel("sla-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => refetch(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, refetch])

  const overdue = tickets.filter(
    (t) =>
      t.sla_breached_at != null ||
      (t.sla_due_at != null && new Date(t.sla_due_at).getTime() <= Date.now()),
  )
  const onTime = tickets.filter(
    (t) =>
      t.sla_breached_at == null &&
      (t.sla_due_at == null || new Date(t.sla_due_at).getTime() > Date.now()),
  )
  const sorted = [...overdue, ...onTime]

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold text-foreground">متابعة SLA</h1>
        <span className="text-sm text-muted-foreground tabular">
          {formatNumber(tickets.length)} طلب معلق
        </span>
        {overdue.length > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-[var(--status-breach-bg)] text-[var(--status-breach)]">
            <AlertTriangle size={12} />
            {formatNumber(overdue.length)} متأخر
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
          مفيش طلبات معلقة دلوقتي
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-start px-4 py-2.5 font-medium">الفرع</th>
                <th className="text-start px-4 py-2.5 font-medium">العميل</th>
                <th className="text-start px-4 py-2.5 font-medium">الدكتورة</th>
                <th className="text-start px-4 py-2.5 font-medium">الميعاد</th>
                <th className="text-start px-4 py-2.5 font-medium">SLA</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const isOverdue =
                  t.sla_breached_at != null ||
                  (t.sla_due_at != null &&
                    new Date(t.sla_due_at).getTime() <= Date.now())
                return (
                  <tr
                    key={t.id}
                    className={cn(
                      "border-b border-border last:border-b-0",
                      isOverdue && "bg-[var(--status-breach-bg)]/30",
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {t.branch_name}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {t.customer_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.doctor_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular">
                      {ddmm(t.appt_date)} {hhmm(t.start_time)}
                    </td>
                    <td className="px-4 py-3">
                      {t.sla_due_at && (
                        <SlaCountdown
                          dueAt={t.sla_due_at}
                          breachedAt={t.sla_breached_at}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
