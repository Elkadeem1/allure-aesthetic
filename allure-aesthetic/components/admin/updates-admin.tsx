"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarClock, Plus, Trash2, CalendarMinus, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "cn"
import { formatTime } from "@/lib/format"
import { UPDATE_TYPE_LABEL, SHIFT_KINDS } from "@/lib/admin/update-schema"
import { UpdateDialog, type DialogBranch } from "./update-dialog"
import { deleteDoctorUpdateAction, endUpdateTodayAction } from "@/app/(admin)/admin/updates/actions"
import type { UpdateType } from "@/lib/types/database.types"

export type AdminBranch = DialogBranch & { sort: number }

export type UpdateRow = {
  id: string
  branchId: string
  branchName: string
  branchSort: number
  doctorId: string | null
  doctorName: string | null
  type: UpdateType
  dateFrom: string
  dateTo: string
  atTime: string | null
  weekdays: number[]
  segments: { start: string; end: string; kind?: string }[]
  note: string | null
  createdAt: string
  createdBy: string | null
}

const DAY_LABELS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]

// Chip colour per type. Red is reserved for off/full (hard blocks).
const TYPE_CHIP: Record<string, { bg: string; text: string }> = {
  off: { bg: "var(--status-breach-bg)", text: "var(--status-breach)" },
  full: { bg: "var(--status-breach-bg)", text: "var(--status-breach)" },
  stop: { bg: "var(--status-open-bg)", text: "var(--status-open)" },
  booking_cutoff: { bg: "var(--status-open-bg)", text: "var(--status-open)" },
  laser_stop: { bg: "var(--status-open-bg)", text: "var(--status-open)" },
  hours: { bg: "var(--status-request-bg)", text: "var(--status-request)" },
  open_slot: { bg: "var(--status-confirmed-bg)", text: "var(--status-confirmed)" },
  note: { bg: "var(--status-notice-bg)", text: "var(--status-notice)" },
}

function weekdaySat0(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // Sun=0
  return (dow + 1) % 7
}

/** Does an update apply on a given Cairo date? Mirrors engine appliesOn(). */
function appliesOn(u: UpdateRow, date: string): boolean {
  if (date < u.dateFrom || date > u.dateTo) return false
  if (u.weekdays.length > 0) return u.weekdays.includes(weekdaySat0(date))
  return true
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

function dateLabel(iso: string): string {
  const [, m, d] = iso.split("-")
  return `${Number(d)}/${Number(m)}`
}

function whenText(u: UpdateRow): string {
  if (u.weekdays.length > 0) {
    return "كل " + u.weekdays.map((d) => DAY_LABELS[d]).join("، ")
  }
  if (u.dateFrom === u.dateTo) return dateLabel(u.dateFrom)
  return `${dateLabel(u.dateFrom)} → ${dateLabel(u.dateTo)}`
}

function timesText(u: UpdateRow): string | null {
  if (u.atTime) return `من ${formatTime(u.atTime.slice(0, 5))}`
  if (u.segments.length > 0) {
    return u.segments
      .map((s) => {
        const kind = SHIFT_KINDS.find((k) => k.value === s.kind)?.label
        return `${formatTime(s.start.slice(0, 5))}–${formatTime(s.end.slice(0, 5))}${kind ? ` (${kind})` : ""}`
      })
      .join("، ")
  }
  return null
}

type TimeFilter = "today" | "week" | "all"

export function UpdatesAdmin({
  updates,
  branches,
  today,
}: {
  updates: UpdateRow[]
  branches: AdminBranch[]
  today: string
}) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [branchFilter, setBranchFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("today")
  const [busyId, setBusyId] = useState<string | null>(null)

  const weekEnd = addDays(today, 6)

  const filtered = useMemo(() => {
    return updates.filter((u) => {
      if (branchFilter !== "all" && u.branchId !== branchFilter) return false
      if (typeFilter !== "all" && u.type !== typeFilter) return false
      if (timeFilter === "today") return appliesOn(u, today)
      if (timeFilter === "week") {
        // any active day inside [today, weekEnd]
        for (let d = today; d <= weekEnd; d = addDays(d, 1)) if (appliesOn(u, d)) return true
        return false
      }
      return true
    })
  }, [updates, branchFilter, typeFilter, timeFilter, today, weekEnd])

  // Group by branch, keeping branch sort order.
  const groups = useMemo(() => {
    const byBranch = new Map<string, UpdateRow[]>()
    for (const u of filtered) {
      const list = byBranch.get(u.branchId) ?? []
      list.push(u)
      byBranch.set(u.branchId, list)
    }
    return [...byBranch.entries()]
      .map(([branchId, rows]) => ({
        branchId,
        name: rows[0].branchName,
        sort: rows[0].branchSort,
        rows,
      }))
      .sort((a, b) => a.sort - b.sort)
  }, [filtered])

  const handleDelete = async (id: string) => {
    setBusyId(id)
    const res = await deleteDoctorUpdateAction(id)
    setBusyId(null)
    if (res.ok) {
      toast.success("اتمسح التحديث")
      router.refresh()
    } else toast.error(res.error)
  }

  const handleEndToday = async (id: string) => {
    setBusyId(id)
    const res = await endUpdateTodayAction(id)
    setBusyId(null)
    if (res.ok) {
      toast.success("اتنهى النهاردة")
      router.refresh()
    } else toast.error(res.error)
  }

  const selectCls = "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground"

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">Updates</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus size={15} className="me-1" /> إضافة Update
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectCls} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="all">كل الفروع</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nameAr}
            </option>
          ))}
        </select>
        <select className={selectCls} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">كل الأنواع</option>
          {Object.entries(UPDATE_TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <div className="flex gap-1 ms-auto">
          {([
            ["today", "النهاردة"],
            ["week", "الأسبوع ده"],
            ["all", "الكل"],
          ] as [TimeFilter, string][]).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTimeFilter(v)}
              className={cn(
                "text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
                timeFilter === v
                  ? "border-primary bg-accent text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card rounded-xl border border-border text-muted-foreground text-sm">
          <CalendarClock size={24} className="mb-2 opacity-40" />
          مفيش تحديثات في النطاق ده.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.branchId} className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Building2 size={14} className="text-muted-foreground" />
                {g.name}
                <span className="text-xs text-muted-foreground font-normal">({g.rows.length})</span>
              </h2>
              <div className="space-y-2">
                {g.rows.map((u) => {
                  const chip = TYPE_CHIP[u.type] ?? TYPE_CHIP.note
                  const times = timesText(u)
                  const activeToday = appliesOn(u, today)
                  return (
                    <div
                      key={u.id}
                      className="bg-card border border-border rounded-xl p-3.5 flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">
                            {u.doctorName ?? "الفرع كله"}
                          </span>
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: chip.bg, color: chip.text }}
                          >
                            {UPDATE_TYPE_LABEL[u.type] ?? u.type}
                          </span>
                          <span className="text-xs text-muted-foreground tabular">{whenText(u)}</span>
                          {times && <span className="text-xs text-muted-foreground tabular">· {times}</span>}
                        </div>
                        {u.note && <p className="text-xs text-foreground">{u.note}</p>}
                        {u.createdBy && (
                          <p className="text-[11px] text-muted-foreground">أضافه: {u.createdBy}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {activeToday && u.dateTo > today && (
                          <button
                            onClick={() => handleEndToday(u.id)}
                            disabled={busyId === u.id}
                            title="تنهي النهاردة"
                            className="p-1.5 rounded-lg text-[var(--status-open)] hover:bg-[var(--status-open-bg)] disabled:opacity-40"
                          >
                            <CalendarMinus size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={busyId === u.id}
                          title="مسح"
                          className="p-1.5 rounded-lg text-[var(--status-breach)] hover:bg-[var(--status-breach-bg)] disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <UpdateDialog
        branches={branches}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
