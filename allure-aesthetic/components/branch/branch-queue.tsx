"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  Phone,
  User,
  Calendar,
  Stethoscope,
  Timer,
  Check,
  X,
  MessageSquare,
} from "lucide-react"
import { cn } from "cn"
import { createClient } from "@/lib/supabase/client"
import { formatNumber, formatTime } from "@/lib/format"
import { cairoToday, cairoDayRange } from "@/lib/time"
import { Button } from "@/components/ui/button"
import type { Database, BranchResponse } from "@/lib/types/database.types"
import {
  branchRespondAction,
  acknowledgeNoticeAction,
} from "@/app/(branch)/branch/actions"
import { TicketHistory } from "./ticket-history"

type Ticket = Database["public"]["Views"]["ticket_board"]["Row"]
type Doctor = { id: string; display_name: string }

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function hhmm(t: string | null): string {
  return t ? formatTime(t.slice(0, 5)) : ""
}

function ddmm(date: string | null): string {
  if (!date) return ""
  const [, m, d] = date.split("-")
  return `${d}/${m}`
}

function playAlertSound() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    const ctx = new AC()
    const play = (freq: number, start: number) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.type = "sine"
      o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, ctx.currentTime + start)
      g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + start + 0.02)
      g.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + start + 0.3,
      )
      o.start(ctx.currentTime + start)
      o.stop(ctx.currentTime + start + 0.35)
    }
    play(880, 0)
    play(1100, 0.35)
    setTimeout(() => ctx.close(), 1000)
  } catch {
    /* audio not available */
  }
}

/* ------------------------------------------------------------------ */
/* Responder name (localStorage)                                      */
/* ------------------------------------------------------------------ */

const RESPONDER_KEY = "allure_responder_name"

function useResponderName(): [string, (n: string) => void] {
  const [name, setNameState] = useState("")
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RESPONDER_KEY)
      if (stored) setNameState(stored)
    } catch {
      /* */
    }
  }, [])
  const setName = useCallback((n: string) => {
    setNameState(n)
    try {
      localStorage.setItem(RESPONDER_KEY, n)
    } catch {
      /* */
    }
  }, [])
  return [name, setName]
}

/* ------------------------------------------------------------------ */
/* SLA Countdown — large                                              */
/* ------------------------------------------------------------------ */

function SlaCountdownLarge({
  dueAt,
  breachedAt,
}: {
  dueAt: string
  breachedAt: string | null
}) {
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
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl font-bold",
        breached
          ? "animate-sla-pulse bg-[var(--status-breach-bg)] text-[var(--status-breach)]"
          : "bg-[var(--status-request-bg)] text-[var(--status-request)]",
      )}
    >
      {breached ? <AlertTriangle size={20} /> : <Timer size={20} />}
      <span className="text-lg tabular">
        {breached ? `متأخر ${display}` : `باقي ${display}`}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Counter Offer Form                                                  */
/* ------------------------------------------------------------------ */

function CounterOfferForm({
  ticket,
  doctors,
  responderName,
  onDone,
}: {
  ticket: Ticket
  doctors: Doctor[]
  responderName: string
  onDone: () => void
}) {
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [doctorId, setDoctorId] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const today = useMemo(() => cairoToday(), [])

  const submit = async () => {
    if (!date || !time) {
      toast.error("لازم تختار تاريخ ووقت للميعاد البديل.")
      return
    }
    setBusy(true)
    const res = await branchRespondAction({
      ticketId: ticket.id!,
      response: "counter_offer",
      responderName,
      note: note.trim() || undefined,
      counterDate: date,
      counterStartTime: `${time}:00`,
      counterDoctorId: doctorId || undefined,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("اتبعت الميعاد البديل")
      onDone()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30 space-y-3">
      <p className="text-sm font-semibold text-foreground">ميعاد بديل</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            التاريخ
          </label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            الوقت
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring"
          />
        </div>
      </div>
      {doctors.length > 1 && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            دكتورة بديلة (اختياري)
          </label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="w-full h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring"
          >
            <option value="">نفس الدكتورة</option>
            {doctors
              .filter((d) => d.id !== ticket.doctor_id)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.display_name}
                </option>
              ))}
          </select>
        </div>
      )}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          ملاحظة (اختياري)
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="تفاصيل إضافية..."
          className="w-full h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring"
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} loading={busy} size="sm">
          ابعت الميعاد البديل
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          إلغاء
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Unavailable Form                                                    */
/* ------------------------------------------------------------------ */

const UNAVAILABLE_REASONS = [
  "الدكتورة مش موجودة",
  "الدور مليان",
  "الميعاد ده محجوز",
  "العيادة مقفولة",
  "إجازة",
]

function UnavailableForm({
  ticket,
  responderName,
  onDone,
}: {
  ticket: Ticket
  responderName: string
  onDone: () => void
}) {
  const [reason, setReason] = useState("")
  const [custom, setCustom] = useState("")
  const [busy, setBusy] = useState(false)

  const finalReason = reason === "__custom" ? custom.trim() : reason

  const submit = async () => {
    if (!finalReason) {
      toast.error("لازم تختار أو تكتب سبب.")
      return
    }
    setBusy(true)
    const res = await branchRespondAction({
      ticketId: ticket.id!,
      response: "unavailable",
      responderName,
      note: finalReason,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("اتسجل إن الميعاد مش متاح")
      onDone()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30 space-y-3">
      <p className="text-sm font-semibold text-foreground">سبب عدم التوفر</p>
      <div className="flex flex-wrap gap-2">
        {UNAVAILABLE_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setReason(r)
              setCustom("")
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              reason === r
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {r}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setReason("__custom")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
            reason === "__custom"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          سبب تاني
        </button>
      </div>
      {reason === "__custom" && (
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="اكتب السبب..."
          className="w-full h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring"
          autoFocus
        />
      )}
      <div className="flex gap-2">
        <Button
          onClick={submit}
          loading={busy}
          variant="danger"
          size="sm"
          disabled={!finalReason}
        >
          تأكيد — مش متاح
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          إلغاء
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Request Card                                                        */
/* ------------------------------------------------------------------ */

function RequestCard({
  ticket: t,
  doctors,
  responderName,
  onRefetch,
  onNameRequired,
}: {
  ticket: Ticket
  doctors: Doctor[]
  responderName: string
  onRefetch: () => void
  onNameRequired: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [expandedForm, setExpandedForm] = useState<
    "counter" | "unavailable" | null
  >(null)

  const quickRespond = async (
    response: "agent_confirm" | "branch_confirm",
  ) => {
    if (!responderName.trim()) {
      onNameRequired()
      return
    }
    setBusy(true)
    const res = await branchRespondAction({
      ticketId: t.id!,
      response,
      responderName,
    })
    setBusy(false)
    if (res.ok) {
      toast.success(
        response === "agent_confirm"
          ? "اتبعت للموظف يأكد مع العميل"
          : "اتسجل إن الفرع هيأكد",
      )
      onRefetch()
    } else {
      toast.error(res.error)
    }
  }

  const openForm = (form: "counter" | "unavailable") => {
    if (!responderName.trim()) {
      onNameRequired()
      return
    }
    setExpandedForm(form)
  }

  const isOverdue =
    t.sla_breached_at != null ||
    (t.sla_due_at != null && new Date(t.sla_due_at).getTime() <= Date.now())

  return (
    <div
      className={cn(
        "bg-card border-2 rounded-xl p-5 transition-shadow",
        isOverdue
          ? "border-[var(--status-breach)] animate-sla-pulse shadow-lg"
          : "border-[var(--status-request)] shadow-md",
      )}
    >
      {/* SLA Countdown */}
      {t.sla_due_at && (
        <div className="mb-4">
          <SlaCountdownLarge dueAt={t.sla_due_at} breachedAt={t.sla_breached_at} />
        </div>
      )}

      {/* Ticket info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <User size={16} className="text-primary shrink-0" />
          <span className="text-base font-bold text-foreground">
            {t.customer_name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Phone size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground tabular" dir="ltr">
            {t.customer_phone}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Stethoscope size={16} className="text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground">{t.service_name}</span>
          {t.area_codes && t.area_codes.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({t.area_codes.join("، ")})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Stethoscope size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground">{t.doctor_name}</span>
        </div>

        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm tabular">
            {ddmm(t.appt_date)} &middot; {hhmm(t.start_time)} &ndash;{" "}
            {hhmm(t.end_time)}
          </span>
        </div>

        {t.agent_name && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User size={12} className="shrink-0" />
            <span>الموظف: {t.agent_name}</span>
          </div>
        )}

        {t.agent_note && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <MessageSquare size={12} className="shrink-0 mt-0.5" />
            <span>{t.agent_note}</span>
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-muted-foreground tabular">
        تيكت #{formatNumber(t.ticket_no!)}
      </div>

      {/* Quick actions */}
      {expandedForm === null && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            onClick={() => quickRespond("agent_confirm")}
            loading={busy}
            className="h-12 text-sm"
          >
            <Check size={16} />
            أكدوا إنتوا
          </Button>
          <Button
            onClick={() => quickRespond("branch_confirm")}
            loading={busy}
            variant="secondary"
            className="h-12 text-sm"
          >
            <Check size={16} />
            إحنا هنأكد
          </Button>
          <Button
            onClick={() => openForm("counter")}
            variant="secondary"
            className="h-12 text-sm"
          >
            <Calendar size={16} />
            ميعاد بديل
          </Button>
          <Button
            onClick={() => openForm("unavailable")}
            variant="danger"
            className="h-12 text-sm"
          >
            <X size={16} />
            مش متاح
          </Button>
        </div>
      )}

      {expandedForm === "counter" && (
        <CounterOfferForm
          ticket={t}
          doctors={doctors}
          responderName={responderName}
          onDone={() => {
            setExpandedForm(null)
            onRefetch()
          }}
        />
      )}
      {expandedForm === "unavailable" && (
        <UnavailableForm
          ticket={t}
          responderName={responderName}
          onDone={() => {
            setExpandedForm(null)
            onRefetch()
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Notice Card                                                         */
/* ------------------------------------------------------------------ */

function NoticeCard({
  ticket: t,
  responderName,
  onRefetch,
  onNameRequired,
}: {
  ticket: Ticket
  responderName: string
  onRefetch: () => void
  onNameRequired: () => void
}) {
  const [busy, setBusy] = useState(false)

  const acknowledge = async () => {
    if (!responderName.trim()) {
      onNameRequired()
      return
    }
    setBusy(true)
    const res = await acknowledgeNoticeAction(t.id!, responderName)
    setBusy(false)
    if (res.ok) {
      toast.success("تم الاطلاع")
      onRefetch()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <User size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground">
            {t.customer_name}
          </span>
          <span className="text-xs text-muted-foreground tabular" dir="ltr">
            {t.customer_phone}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <span>{t.doctor_name}</span>
          <span className="text-muted-foreground">&middot;</span>
          <span>{t.service_name}</span>
        </div>
        <div className="text-xs text-muted-foreground tabular">
          {ddmm(t.appt_date)} &middot; {hhmm(t.start_time)} &ndash;{" "}
          {hhmm(t.end_time)}
        </div>
        {t.agent_note && (
          <p className="text-xs text-muted-foreground">{t.agent_note}</p>
        )}
        <p className="text-xs text-muted-foreground tabular">
          تيكت #{formatNumber(t.ticket_no!)}
        </p>
      </div>

      <div className="mt-3">
        <Button onClick={acknowledge} loading={busy} variant="secondary" size="sm">
          <Check size={14} />
          تم الاطلاع
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* BranchQueue — main export                                           */
/* ------------------------------------------------------------------ */

export type BranchQueueProps = {
  userId: string
  branchId: string
  initialRequests: Ticket[]
  initialNotices: Ticket[]
  initialHistory: Ticket[]
  doctors: Doctor[]
}

export function BranchQueue({
  userId,
  branchId,
  initialRequests,
  initialNotices,
  initialHistory,
  doctors,
}: BranchQueueProps) {
  const [requests, setRequests] = useState(initialRequests)
  const [notices, setNotices] = useState(initialNotices)
  const [history, setHistory] = useState(initialHistory)
  const [responderName, setResponderName] = useResponderName()
  const [nameError, setNameError] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const prevRequestCountRef = useRef(initialRequests.length)

  const supabase = useMemo(() => createClient(), [])

  const refetch = useCallback(async () => {
    const { dateStr, startUtc, endUtc } = cairoDayRange()
    const [{ data: pending }, { data: completed }] = await Promise.all([
      supabase
        .from("ticket_board")
        .select("*")
        .eq("branch_id", branchId)
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("ticket_board")
        .select("*")
        .eq("branch_id", branchId)
        .neq("status", "pending")
        .or(
          `and(created_at.gte.${startUtc},created_at.lt.${endUtc}),appt_date.eq.${dateStr}`,
        )
        .order("updated_at", { ascending: false })
        .limit(50),
    ])

    if (pending) {
      setRequests(pending.filter((t) => t.kind === "request"))
      setNotices(pending.filter((t) => t.kind === "notice"))
    }
    if (completed) setHistory(completed)
  }, [supabase, branchId])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`branch-tickets:${branchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `branch_id=eq.${branchId}` },
        () => refetch(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, refetch, branchId])

  // Sound: play on new request arrival
  useEffect(() => {
    const count = requests.length
    if (count > prevRequestCountRef.current) {
      playAlertSound()
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("طلب حجز جديد", {
            body: `فيه ${count} طلب محتاج رد`,
          })
        } catch {
          /* */
        }
      }
    }
    prevRequestCountRef.current = count
  }, [requests.length])

  // Sound: repeat every 30s while requests pending
  useEffect(() => {
    if (requests.length === 0) return
    const id = setInterval(playAlertSound, 30_000)
    return () => clearInterval(id)
  }, [requests.length])

  // Tab title flash
  useEffect(() => {
    if (requests.length === 0) return
    const original = document.title
    let flash = true
    const id = setInterval(() => {
      document.title = flash
        ? `(${requests.length}) طلب جديد`
        : original
      flash = !flash
    }, 1000)
    return () => {
      clearInterval(id)
      document.title = original
    }
  }, [requests.length])

  // Request browser notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }
  }, [])

  const handleNameRequired = useCallback(() => {
    setNameError(true)
    nameInputRef.current?.focus()
    toast.error("لازم تكتب اسمك الأول")
  }, [])

  return (
    <div className="space-y-6">
      {/* Responder name input */}
      <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
        <User size={18} className="text-muted-foreground shrink-0" />
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">
            اسم الموظف المسؤول
          </label>
          <input
            ref={nameInputRef}
            value={responderName}
            onChange={(e) => {
              setResponderName(e.target.value)
              setNameError(false)
            }}
            placeholder="اكتب اسمك هنا..."
            className={cn(
              "w-full h-9 rounded-lg border bg-transparent px-3 text-sm outline-none focus-visible:border-ring",
              nameError ? "border-destructive" : "border-input",
            )}
          />
          {nameError && (
            <p className="text-xs text-destructive mt-1">
              لازم تكتب اسمك الأول قبل الرد
            </p>
          )}
        </div>
      </div>

      {/* Pending requests */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--status-request-bg)] text-[var(--status-request)] text-xs font-bold tabular">
            {requests.length}
          </span>
          طلبات مستنية رد
        </h2>
        {requests.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
            مفيش طلبات دلوقتي
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((t) => (
              <RequestCard
                key={t.id}
                ticket={t}
                doctors={doctors}
                responderName={responderName}
                onRefetch={refetch}
                onNameRequired={handleNameRequired}
              />
            ))}
          </div>
        )}
      </section>

      {/* Pending notices */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--status-notice-bg)] text-[var(--status-notice)] text-xs font-bold tabular">
            {notices.length}
          </span>
          إشعارات حجز
        </h2>
        {notices.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
            مفيش إشعارات دلوقتي
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((t) => (
              <NoticeCard
                key={t.id}
                ticket={t}
                responderName={responderName}
                onRefetch={refetch}
                onNameRequired={handleNameRequired}
              />
            ))}
          </div>
        )}
      </section>

      {/* Today's history */}
      <TicketHistory tickets={history} />
    </div>
  )
}
