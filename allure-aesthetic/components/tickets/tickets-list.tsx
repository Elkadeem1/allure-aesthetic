"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Clock, AlertTriangle, Phone, X, Check, PhoneOff, CalendarClock, Ticket as TicketIcon } from "lucide-react"
import { cn } from "cn"
import { createClient } from "@/lib/supabase/client"
import { formatNumber } from "@/lib/format"
import type { Database, TicketOutcome } from "@/lib/types/database.types"
import { cancelTicketAction, closeTicketAction } from "@/app/(agent)/dashboard/tickets/actions"

type Ticket = Database["public"]["Views"]["ticket_board"]["Row"]

/* ---------- helpers ---------- */

function hhmm(t: string | null): string {
  return t ? t.slice(0, 5) : ""
}
function ddmm(date: string | null): string {
  if (!date) return ""
  const [, m, d] = date.split("-")
  return `${d}/${m}`
}
function playDing() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.type = "sine"
    o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    o.start()
    o.stop(ctx.currentTime + 0.42)
    o.onended = () => ctx.close()
  } catch {
    /* audio not available */
  }
}

const RESPONSE_LABELS: Record<string, string> = {
  agent_confirm: "كلّم العميل وأكّد",
  branch_confirm: "الفرع هيأكد مع العميل",
  counter_offer: "الفرع اقترح ميعاد بديل",
  unavailable: "الفرع قال مش متاح",
}

const OUTCOME_LABELS: Record<string, string> = {
  customer_confirmed: "العميل أكّد",
  customer_declined: "العميل رفض",
  no_answer: "العميل مردش",
  handled_by_branch: "الفرع أكّد",
  notice_acknowledged: "الفرع شاف الإشعار",
}

/* ---------- list ---------- */

export function TicketsList({
  initialTickets,
  doctorNames,
  userId,
  mineOnly,
  orFilter,
}: {
  initialTickets: Ticket[]
  doctorNames: Record<string, string>
  userId: string
  mineOnly: boolean
  orFilter: string
}) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets)
  const [highlight, setHighlight] = useState<Set<string>>(new Set())
  const ticketsRef = useRef<Ticket[]>(initialTickets)
  ticketsRef.current = tickets

  const supabase = useMemo(() => createClient(), [])

  const refetch = useCallback(async () => {
    let q = supabase
      .from("ticket_board")
      .select("*")
      .or(orFilter)
      .order("created_at", { ascending: false })
    if (mineOnly) q = q.eq("created_by", userId)
    const { data } = await q
    if (!data) return

    // Detect a branch answer / acknowledgement on one of MY tickets.
    const prev = new Map(ticketsRef.current.map((t) => [t.id, t]))
    const flash = new Set<string>()
    for (const t of data) {
      const before = prev.get(t.id)
      if (!before || t.created_by !== userId) continue
      const newlyAnswered = !before.responded_at && !!t.responded_at
      const newlyAcked = !before.acknowledged_at && !!t.acknowledged_at
      if (newlyAnswered) {
        flash.add(t.id)
        playDing()
        toast.success(`الفرع ردّ على تيكت #${formatNumber(t.ticket_no)}`)
      } else if (newlyAcked) {
        flash.add(t.id)
        toast(`الفرع شاف إشعار #${formatNumber(t.ticket_no)}`)
      }
    }
    setTickets(data)
    if (flash.size > 0) {
      setHighlight((h) => new Set([...h, ...flash]))
      setTimeout(() => {
        setHighlight((h) => {
          const next = new Set(h)
          flash.forEach((id) => next.delete(id))
          return next
        })
      }, 5000)
    }
  }, [supabase, orFilter, mineOnly, userId])

  useEffect(() => {
    const channel = supabase
      .channel("my-tickets")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          ...(mineOnly ? { filter: `created_by=eq.${userId}` } : {}),
        },
        () => refetch()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, mineOnly, userId, refetch])

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl text-muted-foreground">
        <TicketIcon size={26} className="mb-2 opacity-40" />
        <p className="text-sm">مفيش تيكتات النهاردة</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tickets.map((t) => (
        <TicketCard
          key={t.id}
          ticket={t}
          doctorNames={doctorNames}
          highlighted={highlight.has(t.id)}
          onChanged={refetch}
        />
      ))}
    </div>
  )
}

/* ---------- SLA countdown ---------- */

function SlaCountdown({ dueAt, breachedAt }: { dueAt: string; breachedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remaining = new Date(dueAt).getTime() - now
  const breached = breachedAt != null || remaining <= 0

  if (breached) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold animate-sla-pulse bg-[var(--status-breach-bg)] text-[var(--status-breach)]">
        <AlertTriangle size={12} />
        تعدّى الـ SLA
      </span>
    )
  }
  const sec = Math.floor(remaining / 1000)
  const mm = Math.floor(sec / 60)
  const ss = sec % 60
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular bg-[var(--status-request-bg)] text-[var(--status-request)]">
      <Clock size={12} />
      {formatNumber(mm)}:{ss.toString().padStart(2, "0")}
    </span>
  )
}

/* ---------- status chip ---------- */

function StatusChip({ ticket }: { ticket: Ticket }) {
  let bg = "var(--status-notice-bg)"
  let fg = "var(--status-notice)"
  let label = "—"
  if (ticket.status === "pending") {
    if (ticket.kind === "request") {
      bg = "var(--status-request-bg)"
      fg = "var(--status-request)"
      label = "بانتظار رد الفرع"
    } else {
      label = "بانتظار استلام الفرع"
    }
  } else if (ticket.status === "answered") {
    bg = "var(--status-open-bg)"
    fg = "var(--status-open)"
    label = "محتاج تقفيل"
  } else if (ticket.status === "closed") {
    bg = "var(--status-confirmed-bg)"
    fg = "var(--status-confirmed)"
    label = "مقفول"
  } else if (ticket.status === "cancelled") {
    label = "ملغي"
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  )
}

/* ---------- card ---------- */

function TicketCard({
  ticket: t,
  doctorNames,
  highlighted,
  onChanged,
}: {
  ticket: Ticket
  doctorNames: Record<string, string>
  highlighted: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState("")

  const kindTone =
    t.kind === "request"
      ? { bg: "var(--status-request-bg)", fg: "var(--status-request)", label: "طلب" }
      : { bg: "var(--status-notice-bg)", fg: "var(--status-notice)", label: "إشعار" }

  const close = useCallback(
    async (outcome: TicketOutcome) => {
      setBusy(true)
      const res = await closeTicketAction(t.id, outcome)
      setBusy(false)
      if (res.ok) {
        toast.success("اتقفل التيكت")
        onChanged()
      } else toast.error(res.error)
    },
    [t.id, onChanged]
  )

  const doCancel = useCallback(async () => {
    setBusy(true)
    const res = await cancelTicketAction(t.id, reason)
    setBusy(false)
    if (res.ok) {
      toast.success("اتلغى التيكت")
      setCancelling(false)
      setReason("")
      onChanged()
    } else toast.error(res.error)
  }, [t.id, reason, onChanged])

  const canCancel = t.status === "pending" || t.status === "answered"
  const showCloseButtons =
    t.status === "answered" &&
    (t.branch_response === "agent_confirm" ||
      t.branch_response === "counter_offer" ||
      t.branch_response === "unavailable")

  return (
    <div
      className={cn(
        "bg-card border rounded-xl p-4 transition-shadow",
        highlighted ? "border-primary ring-2 ring-primary/40 shadow-md" : "border-border"
      )}
    >
      {/* header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
          style={{ backgroundColor: kindTone.bg, color: kindTone.fg }}
        >
          {kindTone.label}
        </span>
        <span className="text-sm font-bold text-foreground tabular">#{formatNumber(t.ticket_no)}</span>
        <StatusChip ticket={t} />
        {t.kind === "request" && t.status === "pending" && t.sla_due_at && (
          <SlaCountdown dueAt={t.sla_due_at} breachedAt={t.sla_breached_at} />
        )}
        <span className="ms-auto text-xs text-muted-foreground tabular" dir="ltr">
          {ddmm(t.appt_date)} · {hhmm(t.start_time)}
        </span>
      </div>

      {/* info */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-medium text-foreground">{t.customer_name}</span>
        <span className="text-muted-foreground tabular" dir="ltr">
          {t.customer_phone}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-foreground">{t.doctor_name}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{t.branch_name}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{t.service_name}</span>
      </div>

      {/* branch answer */}
      {t.branch_response && t.status !== "cancelled" && (
        <div className="mt-3 rounded-lg bg-muted/50 border border-border p-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Phone size={13} className="text-primary" />
            {RESPONSE_LABELS[t.branch_response] ?? t.branch_response}
          </p>
          {t.branch_response === "counter_offer" && (
            <p className="mt-1 text-xs text-foreground flex items-center gap-1.5">
              <CalendarClock size={12} className="text-muted-foreground" />
              <span dir="ltr" className="tabular">
                {ddmm(t.counter_date)} · {hhmm(t.counter_start_time)}
              </span>
              {t.counter_doctor_id && (
                <span className="text-muted-foreground">
                  — {doctorNames[t.counter_doctor_id] ?? ""}
                </span>
              )}
            </p>
          )}
          {t.response_note && (
            <p className="mt-1 text-xs text-muted-foreground">{t.response_note}</p>
          )}
          {t.responder_name && (
            <p className="mt-1 text-[11px] text-muted-foreground">ردّ: {t.responder_name}</p>
          )}
        </div>
      )}

      {/* notice acknowledged */}
      {t.kind === "notice" && t.acknowledged_at && (
        <p className="mt-2 text-xs font-medium text-[var(--status-confirmed)] flex items-center gap-1">
          <Check size={13} />
          الفرع شاف ✓ {hhmm(t.acknowledged_at.slice(11, 16))}
        </p>
      )}

      {/* closed/cancelled outcome */}
      {(t.status === "closed" || t.status === "cancelled") && t.outcome && (
        <p className="mt-2 text-xs text-muted-foreground">
          النتيجة: {OUTCOME_LABELS[t.outcome] ?? t.outcome}
        </p>
      )}

      {/* close buttons */}
      {showCloseButtons && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => close("customer_confirmed")}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
          >
            <Check size={13} />
            اتأكد
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => close("customer_declined")}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-card border border-border text-foreground text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X size={13} />
            العميل رفض
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => close("no_answer")}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-card border border-border text-foreground text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <PhoneOff size={13} />
            مردش
          </button>
        </div>
      )}

      {/* cancel */}
      {canCancel && (
        <div className="mt-3 border-t border-border/60 pt-2">
          {cancelling ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="سبب الإلغاء"
                className="flex-1 min-w-[160px] h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
              />
              <button
                type="button"
                disabled={busy || reason.trim().length === 0}
                onClick={doCancel}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
              >
                تأكيد الإلغاء
              </button>
              <button
                type="button"
                onClick={() => setCancelling(false)}
                className="px-3 h-8 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                رجوع
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCancelling(true)}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              إلغاء التيكت
            </button>
          )}
        </div>
      )}
    </div>
  )
}
