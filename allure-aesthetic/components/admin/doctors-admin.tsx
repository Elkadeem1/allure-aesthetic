"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Stethoscope, Plus, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "cn"
import {
  createDoctorAction,
  updateDoctorAction,
  saveDoctorScheduleAction,
  saveDoctorLaserCutoffsAction,
} from "@/app/(admin)/admin/actions"
import type { Database, BookingStatus, ShiftKind } from "@/lib/types/database.types"

type Doctor = Database["public"]["Tables"]["doctors"]["Row"]
type Schedule = Database["public"]["Tables"]["doctor_schedules"]["Row"]
type DoctorCutoff = Database["public"]["Tables"]["doctor_laser_cutoffs"]["Row"]

const DAY_LABELS = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]
const SHIFT_LABELS: Record<ShiftKind, string> = { all: "الكل", laser: "ليزر", other: "غير ليزر", derma: "جلدية" }

interface DoctorsAdminProps {
  doctors: Doctor[]
  branches: Array<{ id: string; nameAr: string }>
  schedules: Schedule[]
  doctorCutoffs: DoctorCutoff[]
  laserAreas: Array<{ code: string; name_en: string; gender: string }>
}

export function DoctorsAdmin({
  doctors: initial,
  branches,
  schedules: initialSchedules,
  doctorCutoffs: initialCutoffs,
  laserAreas,
}: DoctorsAdminProps) {
  const [doctors, setDoctors] = useState(initial)
  const [schedules] = useState(initialSchedules)
  const [doctorCutoffs] = useState(initialCutoffs)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterBranch, setFilterBranch] = useState<string | null>(null)

  // Create form
  const [branchId, setBranchId] = useState("")
  const [code, setCode] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [personKey, setPersonKey] = useState("")
  const [defaultStatus, setDefaultStatus] = useState<BookingStatus>("open")
  const [busy, setBusy] = useState(false)

  const filtered = filterBranch ? doctors.filter((d) => d.branch_id === filterBranch) : doctors

  const resetForm = () => {
    setBranchId("")
    setCode("")
    setDisplayName("")
    setPersonKey("")
    setDefaultStatus("open")
    setShowCreate(false)
  }

  const handleCreate = async () => {
    setBusy(true)
    const res = await createDoctorAction({
      branchId,
      code,
      displayName,
      personKey: personKey || null,
      defaultBookingStatus: defaultStatus,
      acceptsMen: false,
      laserMenAllowed: false,
      menLaserAreaCodes: null,
      rejectsSmallAreasOnly: false,
      noOverlap: false,
      notes: null,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("تم إضافة الدكتورة")
      resetForm()
      window.location.reload()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope size={20} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">الأطباء</h1>
          <Badge variant="secondary" className="text-xs">{filtered.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterBranch ?? ""}
            onChange={(e) => setFilterBranch(e.target.value || null)}
            className="h-8 rounded-lg border border-input bg-background px-3 text-xs"
          >
            <option value="">كل الفروع</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.nameAr}</option>
            ))}
          </select>
          <Button
            variant={showCreate ? "secondary" : "default"}
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
          >
            <Plus size={14} className="me-1" />
            دكتورة جديدة
          </Button>
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">دكتورة جديدة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>الفرع</Label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">اختر الفرع</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.nameAr}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>الكود</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="heba_maadi" />
              </div>
              <div className="space-y-1">
                <Label>الاسم</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="د. هبة" />
              </div>
              <div className="space-y-1">
                <Label>person_key</Label>
                <Input value={personKey} onChange={(e) => setPersonKey(e.target.value)} placeholder="اختياري — نفس الشخص في فروع مختلفة" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>حالة الحجز الافتراضية</Label>
              <select
                value={defaultStatus}
                onChange={(e) => setDefaultStatus(e.target.value as BookingStatus)}
                className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="open">Open</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleCreate} loading={busy}>إضافة</Button>
              <Button size="sm" variant="secondary" onClick={resetForm}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((d) => (
          <DoctorRow
            key={d.id}
            doctor={d}
            branchName={branches.find((b) => b.id === d.branch_id)?.nameAr ?? ""}
            schedules={schedules.filter((s) => s.doctor_id === d.id)}
            cutoffs={doctorCutoffs.filter((c) => c.doctor_id === d.id)}
            laserAreas={laserAreas}
            expanded={expandedId === d.id}
            onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)}
            onUpdated={(updated) => {
              setDoctors((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
            }}
          />
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 bg-card border border-border rounded-xl text-muted-foreground">
            <Stethoscope size={26} className="mb-2 opacity-40" />
            <p className="text-sm">مفيش أطباء</p>
          </div>
        )}
      </div>
    </div>
  )
}

function DoctorRow({
  doctor,
  branchName,
  schedules,
  cutoffs,
  laserAreas,
  expanded,
  onToggle,
  onUpdated,
}: {
  doctor: Doctor
  branchName: string
  schedules: Schedule[]
  cutoffs: DoctorCutoff[]
  laserAreas: Array<{ code: string; name_en: string; gender: string }>
  expanded: boolean
  onToggle: () => void
  onUpdated: (d: Partial<Doctor> & { id: string }) => void
}) {
  const [tab, setTab] = useState<"info" | "rules" | "schedule">("info")

  // Info fields
  const [code, setCode] = useState(doctor.code)
  const [displayName, setDisplayName] = useState(doctor.display_name)
  const [personKey, setPersonKey] = useState(doctor.person_key ?? "")
  const [defaultStatus, setDefaultStatus] = useState(doctor.default_booking_status)
  const [isActive, setIsActive] = useState(doctor.is_active)
  const [sort, setSort] = useState(doctor.sort)
  const [notes, setNotes] = useState(doctor.notes ?? "")
  const [busy, setBusy] = useState(false)

  // Rules
  const [acceptsMen, setAcceptsMen] = useState(doctor.accepts_men)
  const [laserMenAllowed, setLaserMenAllowed] = useState(doctor.laser_men_allowed)
  const [menLaserAreaCodes, setMenLaserAreaCodes] = useState<string[]>(doctor.men_laser_area_codes ?? [])
  const [rejectsSmall, setRejectsSmall] = useState(doctor.rejects_small_areas_only)
  const [noOverlap, setNoOverlap] = useState(doctor.no_overlap)

  // Schedule (simple view)
  const [scheduleEntries, setScheduleEntries] = useState(
    schedules.map((s) => ({
      weekday: s.weekday,
      startTime: s.start_time,
      endTime: s.end_time,
      kind: s.kind,
    }))
  )
  const [schedBusy, setSchedBusy] = useState(false)

  const saveInfo = async () => {
    setBusy(true)
    const res = await updateDoctorAction({
      doctorId: doctor.id,
      code,
      displayName,
      personKey: personKey || null,
      defaultBookingStatus: defaultStatus,
      acceptsMen,
      laserMenAllowed,
      menLaserAreaCodes: menLaserAreaCodes.length > 0 ? menLaserAreaCodes : null,
      rejectsSmallAreasOnly: rejectsSmall,
      noOverlap,
      notes: notes || null,
      isActive,
      sort,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("تم التحديث")
      onUpdated({ id: doctor.id, display_name: displayName, is_active: isActive })
    } else {
      toast.error(res.error)
    }
  }

  const saveSchedule = async () => {
    setSchedBusy(true)
    const res = await saveDoctorScheduleAction({
      doctorId: doctor.id,
      entries: scheduleEntries,
    })
    setSchedBusy(false)
    if (res.ok) toast.success("تم حفظ الجدول")
    else toast.error(res.error)
  }

  const addScheduleEntry = () => {
    setScheduleEntries((prev) => [...prev, { weekday: 0, startTime: "10:00", endTime: "18:00", kind: "all" as ShiftKind }])
  }

  const removeScheduleEntry = (idx: number) => {
    setScheduleEntries((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateEntry = (idx: number, field: string, value: string | number) => {
    setScheduleEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e))
    )
  }

  const toggleMenArea = (areaCode: string) => {
    setMenLaserAreaCodes((prev) =>
      prev.includes(areaCode) ? prev.filter((c) => c !== areaCode) : [...prev, areaCode]
    )
  }

  const tabs = [
    { key: "info" as const, label: "البيانات" },
    { key: "rules" as const, label: "القواعد" },
    { key: "schedule" as const, label: "الجدول" },
  ]

  return (
    <div className="bg-card border border-border rounded-xl">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-start">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{doctor.display_name}</p>
          <p className="text-xs text-muted-foreground">
            {branchName} — {doctor.code}
            {doctor.person_key ? ` — ${doctor.person_key}` : ""}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {doctor.default_booking_status === "confirmed" ? "Confirmed" : "Open"}
        </Badge>
        <Badge variant={doctor.is_active ? "default" : "destructive"} className="text-[10px]">
          {doctor.is_active ? "فعالة" : "معطلة"}
        </Badge>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <Separator />
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "info" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>الكود</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>الاسم</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>person_key</Label>
                  <Input value={personKey} onChange={(e) => setPersonKey(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>الترتيب</Label>
                  <Input type="number" value={sort} onChange={(e) => setSort(Number(e.target.value))} className="w-20" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>حالة الحجز الافتراضية</Label>
                <select
                  value={defaultStatus}
                  onChange={(e) => setDefaultStatus(e.target.value as BookingStatus)}
                  className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="open">Open</option>
                  <option value="confirmed">Confirmed</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>ملاحظات</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
                <span>فعالة</span>
              </label>
              <Button size="sm" onClick={saveInfo} loading={busy}>حفظ</Button>
            </div>
          )}

          {tab === "rules" && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={acceptsMen} onChange={(e) => setAcceptsMen(e.target.checked)} className="rounded" />
                <span>تستقبل رجال</span>
              </label>
              {acceptsMen && (
                <>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={laserMenAllowed} onChange={(e) => setLaserMenAllowed(e.target.checked)} className="rounded" />
                    <span>ليزر للرجال</span>
                  </label>
                  {laserMenAllowed && (
                    <div className="space-y-1">
                      <Label>مناطق ليزر الرجال المسموحة</Label>
                      <div className="flex flex-wrap gap-1">
                        {laserAreas
                          .filter((a) => a.gender === "male")
                          .map((a) => (
                            <button
                              key={a.code}
                              onClick={() => toggleMenArea(a.code)}
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors",
                                menLaserAreaCodes.includes(a.code)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {a.name_en}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={rejectsSmall} onChange={(e) => setRejectsSmall(e.target.checked)} className="rounded" />
                <span>ترفض مناطق صغيرة بس</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={noOverlap} onChange={(e) => setNoOverlap(e.target.checked)} className="rounded" />
                <span>مفيش تداخل</span>
              </label>
              <Button size="sm" onClick={saveInfo} loading={busy}>حفظ القواعد</Button>
            </div>
          )}

          {tab === "schedule" && (
            <div className="space-y-3">
              {scheduleEntries.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2 flex-wrap">
                  <select
                    value={entry.weekday}
                    onChange={(e) => updateEntry(idx, "weekday", Number(e.target.value))}
                    className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                  >
                    {DAY_LABELS.map((label, i) => (
                      <option key={i} value={i}>{label}</option>
                    ))}
                  </select>
                  <Input
                    type="time"
                    value={entry.startTime}
                    onChange={(e) => updateEntry(idx, "startTime", e.target.value)}
                    className="w-28"
                  />
                  <span className="text-xs text-muted-foreground">—</span>
                  <Input
                    type="time"
                    value={entry.endTime}
                    onChange={(e) => updateEntry(idx, "endTime", e.target.value)}
                    className="w-28"
                  />
                  <select
                    value={entry.kind}
                    onChange={(e) => updateEntry(idx, "kind", e.target.value)}
                    className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                  >
                    {Object.entries(SHIFT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeScheduleEntry(idx)}
                    className="text-destructive"
                  >
                    ×
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={addScheduleEntry}>
                  <Plus size={12} className="me-1" />
                  فترة جديدة
                </Button>
                <Button size="sm" onClick={saveSchedule} loading={schedBusy}>حفظ الجدول</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
