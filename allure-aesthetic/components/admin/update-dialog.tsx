"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { X, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cairoToday } from "@/lib/time"
import {
  UPDATE_TYPES,
  SHIFT_KINDS,
  updateInputSchema,
} from "@/lib/admin/update-schema"
import type { ShiftKind, UpdateType } from "@/lib/types/database.types"
import { createDoctorUpdateAction } from "@/app/(admin)/admin/updates/actions"

export type DialogBranch = {
  id: string
  nameAr: string
  doctors: { id: string; displayName: string }[]
}

type Props = {
  branches: DialogBranch[]
  open: boolean
  onClose: () => void
  onSaved?: () => void
  prefill?: { branchId: string; doctorId?: string | null }
}

const DAY_LABELS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]
const FAR_FUTURE = "2099-12-31"
const SELECT_CLS =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"

/** UTC-safe date add, keeping a YYYY-MM-DD string. */
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

type WhenMode = "single" | "range" | "recurring"
type Segment = { start: string; end: string; kind: ShiftKind }

export function UpdateDialog({ branches, open, onClose, onSaved, prefill }: Props) {
  const today = cairoToday()

  const [branchId, setBranchId] = useState("")
  const [doctorId, setDoctorId] = useState<string | null>(null) // null = whole branch
  const [type, setType] = useState<UpdateType>("off")
  const [whenMode, setWhenMode] = useState<WhenMode>("single")
  const [singleDate, setSingleDate] = useState(today)
  const [rangeFrom, setRangeFrom] = useState(today)
  const [rangeTo, setRangeTo] = useState(addDays(today, 1))
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [recFrom, setRecFrom] = useState(today)
  const [recTo, setRecTo] = useState("")
  const [atTime, setAtTime] = useState("")
  const [segments, setSegments] = useState<Segment[]>([{ start: "", end: "", kind: "all" }])
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  // (Re)seed the form each time it opens.
  useEffect(() => {
    if (!open) return
    const bId = prefill?.branchId ?? branches[0]?.id ?? ""
    setBranchId(bId)
    setDoctorId(prefill?.doctorId ?? null)
    setType("off")
    setWhenMode("single")
    setSingleDate(today)
    setRangeFrom(today)
    setRangeTo(addDays(today, 1))
    setWeekdays([])
    setRecFrom(today)
    setRecTo("")
    setAtTime("")
    setSegments([{ start: "", end: "", kind: "all" }])
    setNote("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [open, onClose])

  const branch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId])
  const isBranchWide = doctorId === null
  const typeMeta = UPDATE_TYPES.find((t) => t.value === type)!
  const availableTypes = isBranchWide ? UPDATE_TYPES.filter((t) => t.branchWide) : UPDATE_TYPES

  // If switching to whole-branch while a doctor-only type is selected, reset it.
  useEffect(() => {
    if (isBranchWide && !typeMeta.branchWide) setType("off")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBranchWide])

  if (!open) return null

  const toggleWeekday = (d: number) =>
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort((a, b) => a - b)))

  const addSegment = () => setSegments((s) => [...s, { start: "", end: "", kind: "all" }])
  const removeSegment = (i: number) => setSegments((s) => s.filter((_, idx) => idx !== i))
  const patchSegment = (i: number, patch: Partial<Segment>) =>
    setSegments((s) => s.map((seg, idx) => (idx === i ? { ...seg, ...patch } : seg)))

  const buildInput = () => {
    let dateFrom = singleDate
    let dateTo = singleDate
    let wd: number[] = []
    if (whenMode === "range") {
      dateFrom = rangeFrom
      dateTo = rangeTo
    } else if (whenMode === "recurring") {
      dateFrom = recFrom || today
      dateTo = recTo || FAR_FUTURE
      wd = weekdays
    }
    return {
      branchId,
      doctorId,
      type,
      dateFrom,
      dateTo,
      weekdays: wd,
      atTime: typeMeta.needsAtTime ? atTime || null : null,
      segments: typeMeta.needsSegments ? segments : [],
      note: note.trim() || null,
    }
  }

  const handleSubmit = async () => {
    const input = buildInput()
    if (input.type === "note") input.note = note.trim() || null
    if (whenMode === "recurring" && weekdays.length === 0) {
      toast.error("اختار يوم واحد على الأقل.")
      return
    }
    const parsed = updateInputSchema.safeParse(input)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "بيانات غير صحيحة.")
      return
    }
    setBusy(true)
    const res = await createDoctorUpdateAction(parsed.data)
    setBusy(false)
    if (res.ok) {
      toast.success("تمت إضافة التحديث")
      onSaved?.()
      onClose()
    } else {
      toast.error(res.error)
    }
  }

  const stepNum = (n: number) => (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-primary text-[11px] font-bold shrink-0">
      {n}
    </span>
  )

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg my-8 bg-card rounded-2xl shadow-lg border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">إضافة Update</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* 1) Branch */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">{stepNum(1)} الفرع</Label>
            <select
              className={SELECT_CLS}
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value)
                setDoctorId(null)
              }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameAr}
                </option>
              ))}
            </select>
          </div>

          {/* 2) Doctor or whole branch */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">{stepNum(2)} الطبيب</Label>
            <select
              className={SELECT_CLS}
              value={doctorId ?? ""}
              onChange={(e) => setDoctorId(e.target.value || null)}
            >
              <option value="">الفرع كله</option>
              {branch?.doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                </option>
              ))}
            </select>
            {isBranchWide && (
              <p className="text-[11px] text-muted-foreground">
                التحديث على الفرع كله: غياب، وقف حجز، الحجز اكتمل، أو ملاحظة فقط.
              </p>
            )}
          </div>

          {/* 3) Type */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">{stepNum(3)} نوع التحديث</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {availableTypes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    "text-start text-xs font-medium px-3 py-2 rounded-lg border transition-colors",
                    type === t.value
                      ? "border-primary bg-accent text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4) When */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">{stepNum(4)} التوقيت</Label>
            <div className="flex gap-1.5">
              {([
                ["single", "يوم واحد"],
                ["range", "فترة"],
                ["recurring", "أيام أسبوعية"],
              ] as [WhenMode, string][]).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setWhenMode(m)}
                  className={cn(
                    "flex-1 text-xs font-medium px-2 py-1.5 rounded-lg border transition-colors",
                    whenMode === m
                      ? "border-primary bg-accent text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {whenMode === "single" && (
              <div className="space-y-1.5 pt-1">
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={singleDate === today ? "default" : "secondary"}
                    onClick={() => setSingleDate(today)}
                  >
                    النهاردة
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={singleDate === addDays(today, 1) ? "default" : "secondary"}
                    onClick={() => setSingleDate(addDays(today, 1))}
                  >
                    بكرة
                  </Button>
                </div>
                <Input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} />
              </div>
            )}

            {whenMode === "range" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">من</Label>
                  <Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">إلى</Label>
                  <Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
                </div>
              </div>
            )}

            {whenMode === "recurring" && (
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleWeekday(i)}
                      className={cn(
                        "text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors",
                        weekdays.includes(i)
                          ? "border-primary bg-accent text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">من (اختياري)</Label>
                    <Input type="date" value={recFrom} onChange={(e) => setRecFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">إلى (اختياري)</Label>
                    <Input type="date" value={recTo} onChange={(e) => setRecTo(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5) Details (type-specific) */}
          {(typeMeta.needsSegments || typeMeta.needsAtTime) && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">{stepNum(5)} التفاصيل</Label>

              {typeMeta.needsAtTime && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">من الساعة</Label>
                  <Input type="time" value={atTime} onChange={(e) => setAtTime(e.target.value)} />
                </div>
              )}

              {typeMeta.needsSegments && (
                <div className="space-y-2">
                  {segments.map((seg, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Input
                        type="time"
                        value={seg.start}
                        onChange={(e) => patchSegment(i, { start: e.target.value })}
                        className="flex-1"
                      />
                      <span className="text-muted-foreground text-xs">→</span>
                      <Input
                        type="time"
                        value={seg.end}
                        onChange={(e) => patchSegment(i, { end: e.target.value })}
                        className="flex-1"
                      />
                      <select
                        className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
                        value={seg.kind}
                        onChange={(e) => patchSegment(i, { kind: e.target.value as ShiftKind })}
                      >
                        {SHIFT_KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                      {segments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSegment(i)}
                          className="p-1.5 rounded-lg text-[var(--status-breach)] hover:bg-[var(--status-breach-bg)]"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="secondary" onClick={addSegment}>
                    <Plus size={14} className="me-1" /> فترة تانية
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 6) Note */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              {stepNum(typeMeta.needsSegments || typeMeta.needsAtTime ? 6 : 5)} ملاحظة
              {typeMeta.needsNote ? "" : " (اختياري)"}
            </Label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              placeholder="تفاصيل إضافية تظهر للموظفين…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <Button onClick={handleSubmit} loading={busy} className="flex-1">
            إضافة
          </Button>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
