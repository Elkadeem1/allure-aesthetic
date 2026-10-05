import { createClient } from "@/lib/supabase/server"
import { toZonedTime } from "date-fns-tz"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { cairoDayRange, cairoNowMinutes, cairoWeekdaySat0 } from "@/lib/time"
import {
  Ticket,
  Clock,
  AlertTriangle,
  Timer,
  Building2,
  Activity,
  CalendarX,
  Ban,
  CalendarClock,
  CircleCheck,
  CircleDot,
  Info,
  Stethoscope,
  Moon,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ---------- helpers ------------------------------------------------- */

/** "10:00:00" | "10:00" -> minutes since midnight. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":")
  return Number(h) * 60 + Number(m)
}

/** "10:00:00" -> "10:00" */
function hhmm(t: string): string {
  return t.slice(0, 5)
}

function formatSecondsAr(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s} ث`
  if (s === 0) return `${m} د`
  return `${m}:${s.toString().padStart(2, "0")} د`
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)  return "الآن"
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`
  return `منذ ${Math.floor(diff / 86400)} يوم`
}

const EVENT_LABELS: Record<string, string> = {
  created:           "تيكت جديد",
  agent_confirmed:   "تأكيد موظف",
  branch_confirmed:  "تأكيد فرع",
  counter_offered:   "عرض بديل",
  unavailable:       "غير متاح",
  acknowledged:      "استلام إشعار",
  closed:            "إغلاق",
  cancelled:         "إلغاء",
  sla_breached:      "خرق SLA",
}

/* ---------- data fetching ------------------------------------------- */

async function fetchAdminData() {
  const supabase = await createClient()
  const { startUtc: todayStart, dateStr: todayStr } = cairoDayRange()

  const [
    ticketsTodayRes,
    pendingRequestsRes,
    slaBreachesRes,
    branchesRes,
    openTicketsRes,
    recentEventsRes,
    recentUpdatesRes,
    avgResponseRes,
    doctorsRes,
    schedulesRes,
    todayUpdatesRes,
  ] = await Promise.all([
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("kind", "request")
      .eq("status", "pending"),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .not("sla_breached_at", "is", null)
      .gte("sla_breached_at", todayStart),
    supabase
      .from("branches")
      .select("id, name_ar, address, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase
      .from("tickets")
      .select("branch_id, kind, status, sla_due_at")
      .in("status", ["pending", "answered"]),
    supabase
      .from("ticket_events")
      .select("id, event, created_at, ticket_id, tickets(ticket_no, branches(name_ar))")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("doctor_updates")
      .select("id, type, note, date_from, created_at, doctors(display_name), branches(name_ar)")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("ticket_board")
      .select("response_seconds")
      .eq("kind", "request")
      .not("response_seconds", "is", null)
      .not("responded_at", "is", null)
      .gte("responded_at", todayStart),
    supabase
      .from("doctors")
      .select("id, branch_id, display_name")
      .eq("is_active", true)
      .order("sort"),
    supabase
      .from("doctor_schedules")
      .select("doctor_id, weekday, start_time, end_time"),
    supabase
      .from("doctor_updates")
      .select("id, branch_id, doctor_id, type, note, segments")
      .lte("date_from", todayStr)
      .gte("date_to", todayStr),
  ])

  const responseTimes = (avgResponseRes.data ?? [])
    .map((r) => r.response_seconds)
    .filter((s): s is number => s !== null)
  const avgResponseSec = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null

  return {
    ticketsToday:    ticketsTodayRes.count    ?? 0,
    pendingRequests: pendingRequestsRes.count ?? 0,
    slaBreaches:     slaBreachesRes.count     ?? 0,
    avgResponseSec,
    branches:        branchesRes.data         ?? [],
    openTickets:     openTicketsRes.data       ?? [],
    recentEvents:    recentEventsRes.data      ?? [],
    recentUpdates:   recentUpdatesRes.data     ?? [],
    doctors:         doctorsRes.data           ?? [],
    schedules:       schedulesRes.data         ?? [],
    todayUpdates:    todayUpdatesRes.data      ?? [],
  }
}

/* ---------- page ---------------------------------------------------- */

export default async function AdminPage() {
  const data = await fetchAdminData()
  const todayAr = format(toZonedTime(new Date(), "Africa/Cairo"), "EEEE، d MMMM yyyy", { locale: ar })

  const now = new Date()
  const weekday = cairoWeekdaySat0()
  const nowMin = cairoNowMinutes()

  // Build the branch status board
  const branchStats = data.branches.map((b) => {
    const bt = data.openTickets.filter((t) => t.branch_id === b.id)
    const pending_requests = bt.filter((t) => t.kind === "request" && t.status === "pending").length
    const overdue = bt.filter(
      (t) => t.kind === "request" && t.status === "pending" && t.sla_due_at && new Date(t.sla_due_at) <= now
    ).length

    const branchUpdates = data.todayUpdates.filter((u) => u.branch_id === b.id)
    const branchWideOff = branchUpdates.some((u) => u.doctor_id === null && u.type === "off")

    // (b) active updates today, as chips — most meaningful first
    const updateChips = branchUpdates
      .map((u) => {
        const doc = u.doctor_id ? data.doctors.find((d) => d.id === u.doctor_id) : null
        return {
          id: u.id,
          type: u.type as string,
          doctorName: doc?.display_name ?? null,
          scope: (u.doctor_id === null ? "branch" : "doctor") as "branch" | "doctor",
          note: u.note as string | null,
        }
      })
      .sort((a, b) => UPDATE_ORDER.indexOf(a.type) - UPDATE_ORDER.indexOf(b.type))

    // (a) doctors on shift right now (unless the whole branch is off today)
    const onShift = branchWideOff
      ? []
      : data.doctors
          .filter((d) => d.branch_id === b.id)
          .map((d) => {
            const docUpdates = branchUpdates.filter((u) => u.doctor_id === d.id)
            if (docUpdates.some((u) => u.type === "off")) return null // absent today

            // 'hours' update replaces the fixed schedule for today
            const hoursUpdate = docUpdates.find((u) => u.type === "hours")
            const segments: Array<{ start: string; end: string }> = hoursUpdate
              ? ((hoursUpdate.segments as Array<{ start: string; end: string }>) ?? [])
              : data.schedules
                  .filter((s) => s.doctor_id === d.id && s.weekday === weekday)
                  .map((s) => ({ start: s.start_time, end: s.end_time }))

            const current = segments.find(
              (s) => timeToMinutes(s.start) <= nowMin && nowMin < timeToMinutes(s.end)
            )
            if (!current) return null
            return { id: d.id, name: d.display_name, start: current.start, end: current.end }
          })
          .filter((x): x is { id: string; name: string; start: string; end: string } => x !== null)
          .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))

    const quiet = !branchWideOff && onShift.length === 0 && updateChips.length === 0 && pending_requests === 0

    return { ...b, pending_requests, overdue, branchWideOff, onShift, updateChips, quiet }
  })

  return (
    <div className="max-w-5xl space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">لوحة الإدارة</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{todayAr}</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Ticket size={18} />}
          label="تيكتات اليوم"
          value={data.ticketsToday}
          color="blue"
        />
        <KpiCard
          icon={<Clock size={18} />}
          label="طلبات معلقة"
          value={data.pendingRequests}
          color={data.pendingRequests > 0 ? "amber" : "grey"}
        />
        <KpiCard
          icon={<AlertTriangle size={18} />}
          label="خرق SLA اليوم"
          value={data.slaBreaches}
          color={data.slaBreaches > 0 ? "red" : "grey"}
        />
        <KpiCard
          icon={<Timer size={18} />}
          label="متوسط رد الفروع"
          value={data.avgResponseSec !== null ? formatSecondsAr(data.avgResponseSec) : "—"}
          color={data.avgResponseSec !== null ? "blue" : "grey"}
          isText
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Branch status board */}
        <section className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">حالة الفروع</h2>

          {branchStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-card rounded-xl border border-border text-muted-foreground text-sm">
              <Building2 size={24} className="mb-2 opacity-40" />
              لا توجد فروع مفعّلة
            </div>
          ) : (
            <div className="space-y-3">
              {branchStats.map((b) => (
                <BranchCard key={b.id} branch={b} />
              ))}
            </div>
          )}
        </section>

        {/* Recent activity */}
        <section className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">آخر النشاطات</h2>

          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            {data.recentEvents.length === 0 && data.recentUpdates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
                <Activity size={22} className="mb-2 opacity-40" />
                لا توجد نشاطات بعد
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {/* Ticket events */}
                {(data.recentEvents as any[]).map((ev: any) => (
                  <li key={ev.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {EVENT_LABELS[ev.event] ?? ev.event}
                        {ev.tickets?.ticket_no && (
                          <span className="text-muted-foreground font-normal"> — #{ev.tickets.ticket_no}</span>
                        )}
                      </p>
                      {ev.tickets?.branches?.name_ar && (
                        <p className="text-[11px] text-muted-foreground truncate">{ev.tickets.branches.name_ar}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 tabular">
                      {timeAgo(ev.created_at)}
                    </span>
                  </li>
                ))}

                {/* Doctor updates */}
                {(data.recentUpdates as any[]).map((upd: any) => (
                  <li key={`du-${upd.id}`} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--status-notice)] mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        <span className="text-muted-foreground font-normal">{upd.doctors?.display_name ?? "—"}</span>
                        {" — "}
                        {updateTypeLabel(upd.type)}
                      </p>
                      {upd.branches?.name_ar && (
                        <p className="text-[11px] text-muted-foreground truncate">{upd.branches.name_ar}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 tabular">
                      {timeAgo(upd.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

/* ---------- sub-components ----------------------------------------- */

function KpiCard({
  icon,
  label,
  value,
  color,
  isText,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  color: "blue" | "amber" | "red" | "grey"
  isText?: boolean
}) {
  const colorMap = {
    blue:  { icon: "bg-accent text-primary",                            value: "text-primary" },
    amber: { icon: "bg-[var(--status-open-bg)] text-[var(--status-open)]",    value: "text-[var(--status-open)]" },
    red:   { icon: "bg-[var(--status-breach-bg)] text-[var(--status-breach)]", value: "text-[var(--status-breach)]" },
    grey:  { icon: "bg-muted text-muted-foreground",                    value: "text-foreground" },
  }
  const c = colorMap[color]

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex items-center gap-4">
      <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${c.icon}`}>
        {icon}
      </div>
      <div>
        <p className={`${isText ? "text-xl" : "text-2xl"} font-bold tabular leading-none ${c.value}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  )
}

/* Update types, ordered by how much they matter on the board. */
const UPDATE_ORDER = ["off", "stop", "hours", "open_slot", "force_open", "note"]

/* Chip styling per update type. Red is reserved for the SLA-breach chip,
   so update chips use slate / blue / green / amber only. */
const UPDATE_CHIP: Record<
  string,
  { icon: React.ElementType; bg: string; text: string }
> = {
  off:        { icon: CalendarX,     bg: "#F1F5F9",                   text: "#475569" },
  stop:       { icon: Ban,           bg: "#F1F5F9",                   text: "#475569" },
  hours:      { icon: CalendarClock, bg: "var(--status-request-bg)",  text: "var(--status-request)" },
  open_slot:  { icon: CircleCheck,   bg: "var(--status-confirmed-bg)", text: "var(--status-confirmed)" },
  force_open: { icon: CircleDot,     bg: "var(--status-open-bg)",     text: "var(--status-open)" },
  note:       { icon: Info,          bg: "#F1F5F9",                   text: "#64748B" },
}

function updateTypeLabel(type: string, scope: "branch" | "doctor" = "doctor"): string {
  if (scope === "branch") {
    const branchLabels: Record<string, string> = {
      off:  "مغلق اليوم",
      stop: "مكتمل الحجز",
      note: "ملاحظة الفرع",
    }
    return branchLabels[type] ?? type
  }
  const labels: Record<string, string> = {
    off:        "غياب",
    stop:       "وقف الحجز",
    hours:      "ساعات مختلفة",
    open_slot:  "الدور فاضي",
    force_open: "حجز مفتوح",
    note:       "ملاحظة",
  }
  return labels[type] ?? type
}

/* ---------- branch status card ------------------------------------- */

type BranchStat = {
  id: string
  name_ar: string
  pending_requests: number
  overdue: number
  branchWideOff: boolean
  onShift: { id: string; name: string; start: string; end: string }[]
  updateChips: {
    id: string
    type: string
    doctorName: string | null
    scope: "branch" | "doctor"
    note: string | null
  }[]
  quiet: boolean
}

function BranchCard({ branch: b }: { branch: BranchStat }) {
  const breached = b.overdue > 0

  return (
    <div
      className={cn(
        "bg-card rounded-xl border shadow-sm p-4",
        breached ? "border-s-[3px] border-s-[var(--status-breach)]" : "border-border"
      )}
    >
      {/* Header: branch name + pending/breach chip */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-accent text-primary">
          <Building2 size={15} />
        </div>
        <p className="flex-1 text-sm font-semibold text-foreground truncate">{b.name_ar}</p>

        {b.pending_requests > 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full tabular shrink-0",
              breached && "animate-sla-pulse"
            )}
            style={
              breached
                ? { backgroundColor: "var(--status-breach-bg)", color: "var(--status-breach)" }
                : { backgroundColor: "var(--status-request-bg)", color: "var(--status-request)" }
            }
          >
            {breached && <AlertTriangle size={12} />}
            {breached ? `${b.pending_requests} طلب · ${b.overdue} متأخر` : `${b.pending_requests} طلب`}
          </span>
        )}
      </div>

      {/* Body */}
      {b.branchWideOff ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium" style={{ color: "#475569" }}>
          <CalendarX size={15} />
          الفرع مغلق اليوم
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {/* (a) doctors on shift right now */}
          {b.onShift.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1.5 shrink-0">
                <Stethoscope size={12} />
                على الشيفت
              </span>
              <div className="flex flex-wrap gap-1.5">
                {b.onShift.map((d) => (
                  <span
                    key={d.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed)]"
                  >
                    <span className="size-1.5 rounded-full bg-[var(--status-confirmed)]" />
                    {d.name}
                    <span className="tabular opacity-80" dir="ltr">
                      {hhmm(d.start)}–{hhmm(d.end)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* (b) active updates today */}
          {b.updateChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {b.updateChips.map((u) => {
                const cfg = UPDATE_CHIP[u.type] ?? UPDATE_CHIP.note
                const Icon = cfg.icon
                return (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg"
                    style={{ backgroundColor: cfg.bg, color: cfg.text }}
                  >
                    <Icon size={12} />
                    {updateTypeLabel(u.type, u.scope)}
                    {u.scope === "doctor" && u.doctorName && (
                      <span className="opacity-70 font-normal">· {u.doctorName}</span>
                    )}
                  </span>
                )
              })}
            </div>
          )}

          {/* Quiet only when there is truly nothing to show */}
          {b.quiet && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Moon size={13} />
              هادي — مفيش حاجة دلوقتي
            </p>
          )}

          {/* Pending/updates exist but nobody is on shift now */}
          {!b.quiet && b.onShift.length === 0 && (
            <p className="text-[11px] text-muted-foreground">مفيش أطباء على الشيفت دلوقتي</p>
          )}
        </div>
      )}
    </div>
  )
}
