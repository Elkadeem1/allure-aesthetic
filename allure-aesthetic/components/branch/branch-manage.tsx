"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  UserX,
  Ban,
  Clock,
  Sparkles,
  ToggleRight,
  StickyNote,
  Building2,
  CalendarDays,
  AlertTriangle,
  Trash2,
  Plus,
  Stethoscope,
} from "lucide-react"
import { cn } from "cn"
import { createClient } from "@/lib/supabase/client"
import { formatTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import type { UpdateType, ShiftKind } from "@/lib/types/database.types"
import {
  createDoctorUpdateAction,
  deleteDoctorUpdateAction,
  saveScheduleAction,
} from "@/app/(branch)/branch/manage/actions"

// --- Types ---

type DoctorInfo = {
  id: string
  displayName: string
  defaultBookingStatus: "open" | "confirmed"
  notes: string | null
  sort: number
}

type UpdateEntry = {
  id: string
  doctorId: string | null
  type: string
  dateFrom: string
  dateTo: string
  note: string | null
  segments: Array<{ start: string; end: string; kind?: string }>
  createdAt: string
}

type ScheduleEntry = {
  id: string
  doctorId: string
  weekday: number
  startTime: string
  endTime: string
  kind: string
}

type ServiceInfo = {
  id: string
  code: string
  name_ar: string
}

export type BranchManageProps = {
  branchId: string
  branchName: string
  today: string
  doctors: DoctorInfo[]
  initialUpdates: UpdateEntry[]
  initialSchedules: ScheduleEntry[]
  services: ServiceInfo[]
}

// --- Constants ---

const DAY_LABELS = [
  "السبت",
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
]

const UPDATE_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  off: {
    label: "غياب",
    icon: UserX,
    color: "var(--status-breach)",
    bg: "var(--status-breach-bg)",
  },
  stop: {
    label: "وقف حجز",
    icon: Ban,
    color: "var(--status-open)",
    bg: "var(--status-open-bg)",
  },
  hours: {
    label: "ساعات مختلفة",
    icon: Clock,
    color: "var(--status-request)",
    bg: "var(--status-request-bg)",
  },
  open_slot: {
    label: "الدور فاضي",
    icon: Sparkles,
    color: "var(--status-confirmed)",
    bg: "var(--status-confirmed-bg)",
  },
  force_open: {
    label: "فتح الدور",
    icon: ToggleRight,
    color: "var(--status-open)",
    bg: "var(--status-open-bg)",
  },
  note: {
    label: "ملاحظة",
    icon: StickyNote,
    color: "var(--status-notice)",
    bg: "var(--status-notice-bg)",
  },
}

const BRANCH_WIDE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  off: {
    label: "الفرع مقفول / Event",
    icon: Building2,
    color: "var(--status-breach)",
    bg: "var(--status-breach-bg)",
  },
  stop: {
    label: "الحجز مكتمل",
    icon: Ban,
    color: "var(--status-open)",
    bg: "var(--status-open-bg)",
  },
  note: {
    label: "ملاحظة للفرع",
    icon: StickyNote,
    color: "var(--status-notice)",
    bg: "var(--status-notice-bg)",
  },
}

const SHIFT_KIND_LABELS: Record<string, string> = {
  all: "الكل",
  laser: "ليزر",
  other: "غير ليزر",
  derma: "جلدية",
}

function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + 1))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`
}

function ddmm(dateStr: string): string {
  if (!dateStr) return ""
  const [, m, d] = dateStr.split("-")
  return `${d}/${m}`
}

// ----------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------

export function BranchManage({
  branchId,
  branchName,
  today,
  doctors,
  initialUpdates,
  initialSchedules,
  services,
}: BranchManageProps) {
  const [activeTab, setActiveTab] = useState<"doctors" | "branch" | "schedule">(
    "doctors",
  )
  const [updates, setUpdates] = useState(initialUpdates)
  const [schedules, setSchedules] = useState(initialSchedules)

  const supabase = useMemo(() => createClient(), [])
  const tomorrow = useMemo(() => nextDay(today), [today])

  const refetch = useCallback(async () => {
    const [{ data: newUpdates }, { data: newSchedules }] = await Promise.all([
      supabase
        .from("doctor_updates")
        .select("*")
        .eq("branch_id", branchId)
        .gte("date_to", today)
        .order("created_at", { ascending: false }),
      supabase
        .from("doctor_schedules")
        .select("id, doctor_id, weekday, start_time, end_time, kind")
        .in(
          "doctor_id",
          doctors.map((d) => d.id),
        )
        .order("weekday")
        .order("start_time"),
    ])
    if (newUpdates) {
      setUpdates(
        newUpdates.map((u) => ({
          id: u.id,
          doctorId: u.doctor_id,
          type: u.type,
          dateFrom: u.date_from,
          dateTo: u.date_to,
          note: u.note,
          segments:
            (u.segments as Array<{
              start: string
              end: string
              kind?: string
            }>) ?? [],
          createdAt: u.created_at,
        })),
      )
    }
    if (newSchedules) {
      setSchedules(
        newSchedules.map((s) => ({
          id: s.id,
          doctorId: s.doctor_id,
          weekday: s.weekday,
          startTime: s.start_time,
          endTime: s.end_time,
          kind: s.kind,
        })),
      )
    }
  }, [supabase, branchId, today, doctors])

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("branch-manage")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "doctor_updates" },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "doctor_schedules" },
        () => refetch(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, refetch])

  // Branch-wide active updates
  const branchWideUpdates = updates.filter(
    (u) => u.doctorId === null && u.dateFrom <= today && u.dateTo >= today,
  )

  return (
    <div className="max-w-4xl space-y-6">
      {/* Branch-wide active status banner */}
      {branchWideUpdates.length > 0 && (
        <div className="space-y-2">
          {branchWideUpdates.map((u) => {
            const cfg =
              BRANCH_WIDE_CONFIG[u.type] ?? BRANCH_WIDE_CONFIG.note
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border-2"
                style={{
                  borderColor: cfg.color,
                  backgroundColor: cfg.bg,
                }}
              >
                <AlertTriangle
                  size={20}
                  style={{ color: cfg.color }}
                  className="shrink-0"
                />
                <div className="flex-1">
                  <p
                    className="text-sm font-bold"
                    style={{ color: cfg.color }}
                  >
                    {cfg.label}
                  </p>
                  {u.note && (
                    <p className="text-xs text-foreground mt-0.5">{u.note}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ddmm(u.dateFrom)}
                    {u.dateTo !== u.dateFrom && ` — ${ddmm(u.dateTo)}`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
        {(
          [
            { key: "doctors", label: "حالة الأطباء", icon: Stethoscope },
            { key: "branch", label: "حالة الفرع", icon: Building2 },
            { key: "schedule", label: "الجدول الأسبوعي", icon: CalendarDays },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "doctors" && (
        <DoctorUpdatesTab
          doctors={doctors}
          updates={updates}
          today={today}
          tomorrow={tomorrow}
          branchId={branchId}
          onRefetch={refetch}
          services={services}
        />
      )}
      {activeTab === "branch" && (
        <BranchWideTab
          branchId={branchId}
          branchName={branchName}
          updates={updates}
          today={today}
          onRefetch={refetch}
        />
      )}
      {activeTab === "schedule" && (
        <ScheduleTab
          doctors={doctors}
          schedules={schedules}
          onRefetch={refetch}
        />
      )}
    </div>
  )
}

// ================================================================
// DOCTOR UPDATES TAB
// ================================================================

function DoctorUpdatesTab({
  doctors,
  updates,
  today,
  tomorrow,
  branchId,
  onRefetch,
  services: _services,
}: {
  doctors: DoctorInfo[]
  updates: UpdateEntry[]
  today: string
  tomorrow: string
  branchId: string
  onRefetch: () => void
  services: ServiceInfo[]
}) {
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {doctors.map((doc) => {
        const docUpdates = updates.filter(
          (u) =>
            u.doctorId === doc.id && u.dateFrom <= today && u.dateTo >= today,
        )
        const allDocUpdates = updates.filter((u) => u.doctorId === doc.id)
        const isExpanded = selectedDoctorId === doc.id

        return (
          <DoctorCard
            key={doc.id}
            doctor={doc}
            activeUpdates={docUpdates}
            allUpdates={allDocUpdates}
            today={today}
            tomorrow={tomorrow}
            branchId={branchId}
            isExpanded={isExpanded}
            onToggle={() =>
              setSelectedDoctorId(isExpanded ? null : doc.id)
            }
            onRefetch={onRefetch}
          />
        )
      })}

      {doctors.length === 0 && (
        <div className="py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
          مفيش أطباء مسجلين للفرع
        </div>
      )}
    </div>
  )
}

// ================================================================
// DOCTOR CARD
// ================================================================

function DoctorCard({
  doctor,
  activeUpdates,
  allUpdates,
  today,
  tomorrow,
  branchId,
  isExpanded,
  onToggle,
  onRefetch,
}: {
  doctor: DoctorInfo
  activeUpdates: UpdateEntry[]
  allUpdates: UpdateEntry[]
  today: string
  tomorrow: string
  branchId: string
  isExpanded: boolean
  onToggle: () => void
  onRefetch: () => void
}) {
  const [showCreateForm, setShowCreateForm] = useState(false)

  const activeStatus = activeUpdates.find(
    (u) => u.type === "open_slot" || u.type === "force_open",
  )

  const effectiveStatus = activeStatus
    ? activeStatus.type === "open_slot"
      ? "confirmed"
      : "open"
    : doctor.defaultBookingStatus

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Doctor header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
          {doctor.displayName.charAt(0)}
        </div>
        <div className="flex-1 text-start min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {doctor.displayName}
          </p>
          {doctor.notes && (
            <p className="text-xs text-muted-foreground truncate">
              {doctor.notes}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge
            status={effectiveStatus}
            label={
              effectiveStatus === "confirmed" ? "Confirmed" : "Open"
            }
          />
          {activeUpdates.length > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeUpdates.length}
            </span>
          )}
        </div>
      </button>

      {/* Active updates summary (always visible) */}
      {activeUpdates.length > 0 && !isExpanded && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {activeUpdates.map((u) => {
            const cfg = UPDATE_TYPE_CONFIG[u.type] ?? UPDATE_TYPE_CONFIG.note
            return (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}
              >
                <cfg.icon size={11} />
                {cfg.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Active updates list */}
          {allUpdates.length > 0 && (
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                التحديثات الحالية والقادمة
              </p>
              {allUpdates.map((u) => (
                <UpdateRow key={u.id} update={u} onRefetch={onRefetch} />
              ))}
            </div>
          )}

          {/* Create new update */}
          {!showCreateForm ? (
            <div className="px-4 py-3 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus size={14} />
                إضافة تحديث
              </Button>
            </div>
          ) : (
            <div className="px-4 py-3 border-t border-border">
              <CreateUpdateForm
                branchId={branchId}
                doctorId={doctor.id}
                doctorName={doctor.displayName}
                today={today}
                tomorrow={tomorrow}
                onDone={() => {
                  setShowCreateForm(false)
                  onRefetch()
                }}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ================================================================
// UPDATE ROW
// ================================================================

function UpdateRow({
  update: u,
  onRefetch,
}: {
  update: UpdateEntry
  onRefetch: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const cfg = UPDATE_TYPE_CONFIG[u.type] ?? UPDATE_TYPE_CONFIG.note

  const handleDelete = async () => {
    setBusy(true)
    const res = await deleteDoctorUpdateAction(u.id)
    setBusy(false)
    if (res.ok) {
      toast.success("اتحذف التحديث")
      onRefetch()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-lg border border-border"
      style={{ backgroundColor: `color-mix(in srgb, ${cfg.bg} 40%, transparent)` }}
    >
      <cfg.icon size={16} style={{ color: cfg.color }} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: cfg.color }}>
          {u.doctorId === null
            ? (BRANCH_WIDE_CONFIG[u.type]?.label ?? cfg.label)
            : cfg.label}
        </p>
        <p className="text-xs text-muted-foreground">
          {ddmm(u.dateFrom)}
          {u.dateTo !== u.dateFrom && ` — ${ddmm(u.dateTo)}`}
        </p>
        {u.note && (
          <p className="text-xs text-foreground mt-0.5 truncate">{u.note}</p>
        )}
        {u.type === "hours" && u.segments.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {u.segments.map((seg, i) => (
              <span
                key={i}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground"
              >
                {formatTime(seg.start)} — {formatTime(seg.end)}
                {seg.kind && seg.kind !== "all" && (
                  <span className="text-muted-foreground me-1">
                    ({SHIFT_KIND_LABELS[seg.kind] ?? seg.kind})
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
          title="حذف"
        >
          <Trash2 size={14} />
        </button>
      ) : (
        <div className="flex gap-1 shrink-0">
          <Button
            variant="danger"
            size="sm"
            loading={busy}
            onClick={handleDelete}
          >
            احذف
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(false)}
          >
            لا
          </Button>
        </div>
      )}
    </div>
  )
}

// ================================================================
// CREATE UPDATE FORM
// ================================================================

const DOCTOR_UPDATE_TYPES: { value: UpdateType; label: string }[] = [
  { value: "off", label: "غياب" },
  { value: "stop", label: "وقف حجز" },
  { value: "hours", label: "ساعات مختلفة" },
  { value: "open_slot", label: "الدور فاضي (Confirmed)" },
  { value: "force_open", label: "فتح الدور (Open)" },
  { value: "note", label: "ملاحظة" },
]

function CreateUpdateForm({
  branchId,
  doctorId,
  doctorName,
  today,
  tomorrow,
  onDone,
  onCancel,
}: {
  branchId: string
  doctorId: string | null
  doctorName: string
  today: string
  tomorrow: string
  onDone: () => void
  onCancel: () => void
}) {
  const [type, setType] = useState<UpdateType>("off")
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [note, setNote] = useState("")
  const [segments, setSegments] = useState<
    Array<{ start: string; end: string; kind: ShiftKind }>
  >([{ start: "10:00", end: "16:00", kind: "all" }])
  const [busy, setBusy] = useState(false)

  const isBranchWide = doctorId === null
  const availableTypes = isBranchWide
    ? (["off", "stop", "note"] as UpdateType[])
    : DOCTOR_UPDATE_TYPES.map((t) => t.value)

  const isStatusChange = type === "open_slot" || type === "force_open"
  const maxDate = isStatusChange ? tomorrow : undefined

  const submit = async () => {
    setBusy(true)
    const res = await createDoctorUpdateAction({
      branchId,
      doctorId,
      type,
      dateFrom,
      dateTo: isStatusChange ? dateTo : dateTo,
      note: note.trim() || undefined,
      segments: type === "hours" ? segments : undefined,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("اتضاف التحديث")
      onDone()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">
        {isBranchWide ? "تحديث على الفرع كله" : `تحديث — ${doctorName}`}
      </p>

      {/* Type selector */}
      <div className="flex flex-wrap gap-1.5">
        {availableTypes.map((t) => {
          const cfg = isBranchWide
            ? (BRANCH_WIDE_CONFIG[t] ?? UPDATE_TYPE_CONFIG[t])
            : (UPDATE_TYPE_CONFIG[t] ?? UPDATE_TYPE_CONFIG.note)
          const info = DOCTOR_UPDATE_TYPES.find((dt) => dt.value === t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                type === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <cfg.icon size={13} />
              {isBranchWide ? cfg.label : (info?.label ?? cfg.label)}
            </button>
          )
        })}
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">من</label>
          <input
            type="date"
            value={dateFrom}
            min={today}
            max={maxDate}
            onChange={(e) => {
              setDateFrom(e.target.value)
              if (e.target.value > dateTo) setDateTo(e.target.value)
            }}
            className="w-full h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">إلى</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={maxDate}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring"
          />
        </div>
      </div>
      {isStatusChange && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertTriangle size={12} className="text-[var(--status-open)]" />
          تغيير الحالة متاح للنهاردة وبكرة بس
        </p>
      )}

      {/* Hours segments */}
      {type === "hours" && (
        <HoursSegmentEditor segments={segments} onChange={setSegments} />
      )}

      {/* Note */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          ملاحظة {type === "note" ? "(مطلوبة)" : "(اختياري)"}
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
          حفظ التحديث
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </div>
  )
}

// ================================================================
// HOURS SEGMENT EDITOR
// ================================================================

function HoursSegmentEditor({
  segments,
  onChange,
}: {
  segments: Array<{ start: string; end: string; kind: ShiftKind }>
  onChange: (
    segs: Array<{ start: string; end: string; kind: ShiftKind }>,
  ) => void
}) {
  const addSegment = () => {
    onChange([...segments, { start: "10:00", end: "16:00", kind: "all" }])
  }

  const removeSegment = (index: number) => {
    onChange(segments.filter((_, i) => i !== index))
  }

  const updateSegment = (
    index: number,
    field: "start" | "end" | "kind",
    value: string,
  ) => {
    const next = [...segments]
    if (field === "kind") {
      next[index] = { ...next[index], kind: value as ShiftKind }
    } else {
      next[index] = { ...next[index], [field]: value }
    }
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">فترات العمل</p>
      {segments.map((seg, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="time"
            value={seg.start}
            onChange={(e) => updateSegment(i, "start", e.target.value)}
            className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus-visible:border-ring"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <input
            type="time"
            value={seg.end}
            onChange={(e) => updateSegment(i, "end", e.target.value)}
            className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus-visible:border-ring"
          />
          <select
            value={seg.kind}
            onChange={(e) => updateSegment(i, "kind", e.target.value)}
            className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus-visible:border-ring"
          >
            <option value="all">الكل</option>
            <option value="laser">ليزر</option>
            <option value="other">غير ليزر</option>
            <option value="derma">جلدية</option>
          </select>
          {segments.length > 1 && (
            <button
              onClick={() => removeSegment(i)}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addSegment}
        className="flex items-center gap-1 text-xs text-primary hover:text-[#1D4ED8] font-medium transition-colors"
      >
        <Plus size={13} />
        إضافة فترة
      </button>
    </div>
  )
}

// ================================================================
// BRANCH-WIDE TAB
// ================================================================

function BranchWideTab({
  branchId,
  branchName,
  updates,
  today,
  onRefetch,
}: {
  branchId: string
  branchName: string
  updates: UpdateEntry[]
  today: string
  onRefetch: () => void
}) {
  const [showForm, setShowForm] = useState(false)

  const branchWideUpdates = updates.filter((u) => u.doctorId === null)

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Building2 size={16} className="text-primary" />
          حالة الفرع — {branchName}
        </h3>

        {branchWideUpdates.length > 0 ? (
          <div className="space-y-2">
            {branchWideUpdates.map((u) => (
              <UpdateRow key={u.id} update={u} onRefetch={onRefetch} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            مفيش تحديثات على الفرع كله
          </p>
        )}

        {!showForm ? (
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowForm(true)}
            >
              <Plus size={14} />
              تحديث على الفرع كله
            </Button>
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t border-border">
            <CreateUpdateForm
              branchId={branchId}
              doctorId={null}
              doctorName=""
              today={today}
              tomorrow={nextDay(today)}
              onDone={() => {
                setShowForm(false)
                onRefetch()
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">
          أنواع التحديثات على الفرع
        </h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Building2
              size={14}
              className="mt-0.5 shrink-0"
              style={{ color: "var(--status-breach)" }}
            />
            <div>
              <p className="font-medium text-foreground">
                الفرع مقفول / Event
              </p>
              <p>لما الفرع مقفول أو فيه مناسبة — مفيش حجز خالص</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Ban
              size={14}
              className="mt-0.5 shrink-0"
              style={{ color: "var(--status-open)" }}
            />
            <div>
              <p className="font-medium text-foreground">الحجز مكتمل</p>
              <p>كل الأطباء محجوزين — وقف حجز مؤقت</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <StickyNote
              size={14}
              className="mt-0.5 shrink-0"
              style={{ color: "var(--status-notice)" }}
            />
            <div>
              <p className="font-medium text-foreground">ملاحظة</p>
              <p>معلومة للموظفين — مش بتأثر على الحجز</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ================================================================
// SCHEDULE TAB
// ================================================================

function ScheduleTab({
  doctors,
  schedules,
  onRefetch,
}: {
  doctors: DoctorInfo[]
  schedules: ScheduleEntry[]
  onRefetch: () => void
}) {
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {doctors.map((doc) => {
        const docSchedules = schedules.filter((s) => s.doctorId === doc.id)
        const isEditing = editingDoctorId === doc.id

        return (
          <DoctorScheduleCard
            key={doc.id}
            doctor={doc}
            schedules={docSchedules}
            isEditing={isEditing}
            onEdit={() =>
              setEditingDoctorId(isEditing ? null : doc.id)
            }
            onRefetch={onRefetch}
          />
        )
      })}

      {doctors.length === 0 && (
        <div className="py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
          مفيش أطباء مسجلين للفرع
        </div>
      )}
    </div>
  )
}

// ================================================================
// DOCTOR SCHEDULE CARD
// ================================================================

type EditableScheduleEntry = {
  weekday: number
  startTime: string
  endTime: string
  kind: ShiftKind
}

function DoctorScheduleCard({
  doctor,
  schedules,
  isEditing,
  onEdit,
  onRefetch,
}: {
  doctor: DoctorInfo
  schedules: ScheduleEntry[]
  isEditing: boolean
  onEdit: () => void
  onRefetch: () => void
}) {
  const [editEntries, setEditEntries] = useState<EditableScheduleEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [confirmSave, setConfirmSave] = useState(false)

  const startEditing = () => {
    setEditEntries(
      schedules.map((s) => ({
        weekday: s.weekday,
        startTime: s.startTime,
        endTime: s.endTime,
        kind: s.kind as ShiftKind,
      })),
    )
    setConfirmSave(false)
    onEdit()
  }

  const cancelEditing = () => {
    setEditEntries([])
    setConfirmSave(false)
    onEdit()
  }

  const addEntry = (weekday: number) => {
    setEditEntries([
      ...editEntries,
      { weekday, startTime: "10:00", endTime: "16:00", kind: "all" },
    ])
  }

  const removeEntry = (index: number) => {
    setEditEntries(editEntries.filter((_, i) => i !== index))
  }

  const updateEntry = (
    index: number,
    field: keyof EditableScheduleEntry,
    value: string | number,
  ) => {
    const next = [...editEntries]
    next[index] = { ...next[index], [field]: value }
    setEditEntries(next)
  }

  const handleSave = async () => {
    setBusy(true)
    const res = await saveScheduleAction({
      doctorId: doctor.id,
      entries: editEntries.map((e) => ({
        doctorId: doctor.id,
        weekday: e.weekday,
        startTime: e.startTime,
        endTime: e.endTime,
        kind: e.kind,
      })),
    })
    setBusy(false)
    if (res.ok) {
      toast.success("اتحفظ الجدول")
      setConfirmSave(false)
      onRefetch()
      onEdit()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
            {doctor.displayName.charAt(0)}
          </div>
          <p className="text-sm font-semibold text-foreground">
            {doctor.displayName}
          </p>
        </div>
        {!isEditing ? (
          <Button variant="secondary" size="sm" onClick={startEditing}>
            <CalendarDays size={13} />
            تعديل الجدول
          </Button>
        ) : (
          <div className="flex gap-1.5">
            {!confirmSave ? (
              <>
                <Button
                  size="sm"
                  onClick={() => setConfirmSave(true)}
                >
                  حفظ
                </Button>
                <Button variant="ghost" size="sm" onClick={cancelEditing}>
                  إلغاء
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  loading={busy}
                  onClick={handleSave}
                >
                  تأكيد الحفظ
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmSave(false)}
                >
                  رجوع
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Schedule grid */}
      <div className="px-4 py-3">
        {isEditing ? (
          <ScheduleEditor
            entries={editEntries}
            onAdd={addEntry}
            onRemove={removeEntry}
            onUpdate={updateEntry}
          />
        ) : (
          <ScheduleReadOnly schedules={schedules} />
        )}
      </div>
    </div>
  )
}

// ================================================================
// SCHEDULE READ ONLY
// ================================================================

function ScheduleReadOnly({ schedules }: { schedules: ScheduleEntry[] }) {
  if (schedules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        مفيش جدول محدد
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-1.5">
      {DAY_LABELS.map((dayLabel, weekday) => {
        const daySchedules = schedules
          .filter((s) => s.weekday === weekday)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))

        return (
          <div
            key={weekday}
            className="flex items-center gap-3 py-1.5 border-b border-border last:border-b-0"
          >
            <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">
              {dayLabel}
            </span>
            {daySchedules.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {daySchedules.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs text-foreground"
                  >
                    {formatTime(s.startTime)} — {formatTime(s.endTime)}
                    {s.kind !== "all" && (
                      <span className="text-muted-foreground">
                        ({SHIFT_KIND_LABELS[s.kind] ?? s.kind})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/50">إجازة</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ================================================================
// SCHEDULE EDITOR
// ================================================================

function ScheduleEditor({
  entries,
  onAdd,
  onRemove,
  onUpdate,
}: {
  entries: EditableScheduleEntry[]
  onAdd: (weekday: number) => void
  onRemove: (index: number) => void
  onUpdate: (
    index: number,
    field: keyof EditableScheduleEntry,
    value: string | number,
  ) => void
}) {
  return (
    <div className="space-y-3">
      {DAY_LABELS.map((dayLabel, weekday) => {
        const dayEntries = entries
          .map((e, i) => ({ ...e, originalIndex: i }))
          .filter((e) => e.weekday === weekday)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))

        return (
          <div key={weekday} className="border-b border-border last:border-b-0 pb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-foreground">
                {dayLabel}
              </span>
              <button
                onClick={() => onAdd(weekday)}
                className="flex items-center gap-0.5 text-[11px] text-primary hover:text-[#1D4ED8] font-medium transition-colors"
              >
                <Plus size={12} />
                فترة
              </button>
            </div>

            {dayEntries.length > 0 ? (
              <div className="space-y-1.5">
                {dayEntries.map((entry) => (
                  <div
                    key={entry.originalIndex}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="time"
                      value={entry.startTime}
                      onChange={(e) =>
                        onUpdate(
                          entry.originalIndex,
                          "startTime",
                          e.target.value,
                        )
                      }
                      className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus-visible:border-ring w-24"
                    />
                    <span className="text-xs text-muted-foreground">—</span>
                    <input
                      type="time"
                      value={entry.endTime}
                      onChange={(e) =>
                        onUpdate(
                          entry.originalIndex,
                          "endTime",
                          e.target.value,
                        )
                      }
                      className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus-visible:border-ring w-24"
                    />
                    <select
                      value={entry.kind}
                      onChange={(e) =>
                        onUpdate(
                          entry.originalIndex,
                          "kind",
                          e.target.value,
                        )
                      }
                      className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus-visible:border-ring"
                    >
                      <option value="all">الكل</option>
                      <option value="laser">ليزر</option>
                      <option value="other">غير ليزر</option>
                      <option value="derma">جلدية</option>
                    </select>
                    <button
                      onClick={() => onRemove(entry.originalIndex)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/50 py-1">إجازة</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
