"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, Trash2, Copy, Save } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { kindMeta, segLabel } from "@/components/dashboard/schedule-utils"
import {
  DAY_LABELS,
  SHIFT_KINDS,
  validateSchedule,
  copyDay,
  toMinutes,
  type ScheduleEntry,
  type ShiftKindValue,
} from "@/lib/admin/doctor-schema"
import { saveScheduleAction } from "@/app/(admin)/admin/doctors/actions"

type Room = { id: string; title: string }

export function ScheduleEditor({
  doctorId,
  initialEntries,
  initialRooms,
  rooms,
  onSaved,
}: {
  doctorId: string
  initialEntries: ScheduleEntry[]
  initialRooms: { weekday: number; roomId: string }[]
  rooms: Room[]
  onSaved?: () => void
}) {
  const [entries, setEntries] = useState<ScheduleEntry[]>(initialEntries)
  const [roomByDay, setRoomByDay] = useState<Record<number, string>>(
    Object.fromEntries(initialRooms.map((r) => [r.weekday, r.roomId]))
  )
  const [copyFrom, setCopyFrom] = useState<number | null>(null)
  const [copyTargets, setCopyTargets] = useState<number[]>([])
  const [busy, setBusy] = useState(false)

  const hasRooms = rooms.length > 0

  const addSegment = (weekday: number) =>
    setEntries((es) => [...es, { weekday, start: "10:00", end: "18:00", kind: "all" as ShiftKindValue }])

  const removeSegment = (globalIdx: number) =>
    setEntries((es) => es.filter((_, i) => i !== globalIdx))

  const patchSegment = (globalIdx: number, patch: Partial<ScheduleEntry>) =>
    setEntries((es) => es.map((e, i) => (i === globalIdx ? { ...e, ...patch } : e)))

  const applyCopy = () => {
    if (copyFrom === null || copyTargets.length === 0) return
    setEntries((es) => copyDay(es, copyFrom, copyTargets))
    toast.success(`اتنسخ ${DAY_LABELS[copyFrom]} على ${copyTargets.length} يوم`)
    setCopyFrom(null)
    setCopyTargets([])
  }

  const save = async () => {
    const err = validateSchedule(entries)
    if (err) {
      toast.error(err)
      return
    }
    // Only send a room for days that actually have a shift + a selected room.
    const workingDays = new Set(entries.map((e) => e.weekday))
    const roomPayload = Object.entries(roomByDay)
      .filter(([day, roomId]) => roomId && workingDays.has(Number(day)))
      .map(([day, roomId]) => ({ weekday: Number(day), roomId }))

    setBusy(true)
    const res = await saveScheduleAction({ doctorId, entries, rooms: roomPayload })
    setBusy(false)
    if (res.ok) {
      toast.success("اتحفظ الجدول")
      onSaved?.()
    } else toast.error(res.error)
  }

  return (
    <div className="space-y-2">
      {DAY_LABELS.map((label, day) => (
        <DayRow
          key={day}
          day={day}
          label={label}
          entries={entries}
          hasRooms={hasRooms}
          rooms={rooms}
          roomId={roomByDay[day] ?? ""}
          onRoomChange={(roomId) => setRoomByDay((m) => ({ ...m, [day]: roomId }))}
          onAdd={() => addSegment(day)}
          onRemove={removeSegment}
          onPatch={patchSegment}
          copyOpen={copyFrom === day}
          copyTargets={copyTargets}
          onCopyToggle={() => {
            setCopyFrom(copyFrom === day ? null : day)
            setCopyTargets([])
          }}
          onCopyTargetToggle={(d) =>
            setCopyTargets((t) => (t.includes(d) ? t.filter((x) => x !== d) : [...t, d]))
          }
          onCopyApply={applyCopy}
        />
      ))}

      <Button onClick={save} loading={busy} className="mt-1">
        <Save size={14} className="me-1" /> حفظ الجدول
      </Button>
    </div>
  )
}

function DayRow({
  day,
  label,
  entries,
  hasRooms,
  rooms,
  roomId,
  onRoomChange,
  onAdd,
  onRemove,
  onPatch,
  copyOpen,
  copyTargets,
  onCopyToggle,
  onCopyTargetToggle,
  onCopyApply,
}: {
  day: number
  label: string
  entries: ScheduleEntry[]
  hasRooms: boolean
  rooms: Room[]
  roomId: string
  onRoomChange: (roomId: string) => void
  onAdd: () => void
  onRemove: (globalIdx: number) => void
  onPatch: (globalIdx: number, patch: Partial<ScheduleEntry>) => void
  copyOpen: boolean
  copyTargets: number[]
  onCopyToggle: () => void
  onCopyTargetToggle: (d: number) => void
  onCopyApply: () => void
}) {
  // Map this day's segments back to their global indices for editing.
  const daySegs = entries
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.weekday === day)

  const selectCls = "h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground"

  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-foreground w-14 shrink-0">{label}</span>
        <div className="flex-1" />
        {daySegs.length > 0 && (
          <button
            type="button"
            onClick={onCopyToggle}
            title="انسخ اليوم ده لأيام تانية"
            className={cn(
              "inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition-colors",
              copyOpen
                ? "border-primary bg-accent text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <Copy size={12} /> نسخ
          </button>
        )}
        {hasRooms && daySegs.length > 0 && (
          <select className={selectCls} value={roomId} onChange={(e) => onRoomChange(e.target.value)}>
            <option value="">— الغرفة —</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        )}
        <Button type="button" size="sm" variant="secondary" onClick={onAdd}>
          <Plus size={13} className="me-1" /> فترة
        </Button>
      </div>

      {/* Segment editors */}
      {daySegs.length === 0 ? (
        <p className="text-xs text-muted-foreground">إجازة — مفيش شيفت.</p>
      ) : (
        <div className="space-y-1.5">
          {daySegs.map(({ e, i }) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input type="time" value={e.start} onChange={(ev) => onPatch(i, { start: ev.target.value })} className="flex-1 h-8" />
              <span className="text-muted-foreground text-xs">→</span>
              <Input type="time" value={e.end} onChange={(ev) => onPatch(i, { end: ev.target.value })} className="flex-1 h-8" />
              <select
                className={selectCls}
                value={e.kind}
                onChange={(ev) => onPatch(i, { kind: ev.target.value as ShiftKindValue })}
              >
                {SHIFT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="p-1.5 rounded-lg text-[var(--status-breach)] hover:bg-[var(--status-breach-bg)]"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Copy-day panel */}
      {copyOpen && (
        <div className="mt-2 p-2 rounded-lg bg-muted/50 space-y-2">
          <p className="text-[11px] text-muted-foreground">انسخ شيفت {label} على:</p>
          <div className="flex flex-wrap gap-1">
            {DAY_LABELS.map((d, di) =>
              di === day ? null : (
                <button
                  key={di}
                  type="button"
                  onClick={() => onCopyTargetToggle(di)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-lg border transition-colors",
                    copyTargets.includes(di)
                      ? "border-primary bg-accent text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {d}
                </button>
              )
            )}
          </div>
          <Button type="button" size="sm" onClick={onCopyApply} disabled={copyTargets.length === 0}>
            نسخ
          </Button>
        </div>
      )}

      {/* Live preview — same segment lines + colored dots as the Branches table */}
      {daySegs.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/60">
          <p className="text-[10px] text-muted-foreground mb-1">المعاينة في صفحة الفروع:</p>
          <div className="flex flex-col gap-0.5">
            {daySegs
              .filter(({ e }) => toMinutes(e.start) < toMinutes(e.end))
              .sort((a, b) => toMinutes(a.e.start) - toMinutes(b.e.start))
              .map(({ e, i }) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-foreground">
                  <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: kindMeta(e.kind).dot }} />
                  <span className="tabular">
                    {segLabel({ from: toMinutes(e.start), to: toMinutes(e.end), kind: e.kind })}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
