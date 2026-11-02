"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Stethoscope, Plus, ChevronDown, ChevronUp, Search, Power, Save, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "cn"
import { gdNorm } from "@/lib/arabic"
import { DAY_LABELS, type ScheduleEntry, type DoctorInput } from "@/lib/admin/doctor-schema"
import { ScheduleEditor } from "./schedule-editor"
import {
  createDoctorAction,
  updateDoctorAction,
  setDoctorActiveAction,
  saveLaserCutoffsAction,
} from "@/app/(admin)/admin/doctors/actions"

export type DoctorRow = {
  id: string
  branchId: string
  displayName: string
  specialty: string | null
  notes: string | null
  personKey: string | null
  alwaysOpen: boolean
  acceptsMen: boolean
  laserMenAllowed: boolean
  menLaserAreaCodes: string[] | null
  rejectsSmallAreasOnly: boolean
  noOverlap: boolean
  isActive: boolean
}

export type AdminBranch = { id: string; nameAr: string; sort: number; rooms: { id: string; title: string }[] }
export type MenArea = { code: string; nameEn: string }

type Props = {
  doctors: DoctorRow[]
  branches: AdminBranch[]
  schedules: Record<string, ScheduleEntry[]>
  doctorRooms: Record<string, { weekday: number; roomId: string }[]>
  laserCutoffs: Record<string, { weekday: number; cutoff: string }[]>
  menAreas: MenArea[]
}

const SELECT_CLS = "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground"

export function DoctorsAdmin({ doctors, branches, schedules, doctorRooms, laserCutoffs, menAreas }: Props) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [branchFilter, setBranchFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active")
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = gdNorm(query)
    return doctors.filter((d) => {
      if (branchFilter !== "all" && d.branchId !== branchFilter) return false
      if (statusFilter === "active" && !d.isActive) return false
      if (statusFilter === "inactive" && d.isActive) return false
      if (q && !gdNorm(d.displayName).includes(q)) return false
      return true
    })
  }, [doctors, branchFilter, statusFilter, query])

  const groups = useMemo(() => {
    const byBranch = new Map<string, DoctorRow[]>()
    for (const d of filtered) {
      const list = byBranch.get(d.branchId) ?? []
      list.push(d)
      byBranch.set(d.branchId, list)
    }
    return branches
      .filter((b) => byBranch.has(b.id))
      .map((b) => ({ branch: b, rows: byBranch.get(b.id)! }))
  }, [filtered, branches])

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">Doctors</h1>
          <span className="text-sm text-muted-foreground">({doctors.length})</span>
        </div>
        <Button onClick={() => setShowCreate((s) => !s)} variant={showCreate ? "secondary" : "default"}>
          <Plus size={15} className="me-1" /> دكتور جديد
        </Button>
      </div>

      {showCreate && (
        <CreateDoctorForm
          branches={branches}
          onDone={() => {
            setShowCreate(false)
            router.refresh()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 h-9 flex-1 min-w-[180px]">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="دور بالاسم…"
            className="flex-1 text-sm bg-transparent outline-none text-foreground"
            dir="rtl"
          />
        </div>
        <select className={SELECT_CLS} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="all">كل الفروع</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nameAr}
            </option>
          ))}
        </select>
        <select className={SELECT_CLS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="active">الفعالين</option>
          <option value="inactive">المعطلين</option>
          <option value="all">الكل</option>
        </select>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card rounded-xl border border-border text-muted-foreground text-sm">
          <Stethoscope size={24} className="mb-2 opacity-40" />
          مفيش أطباء مطابقين.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(({ branch, rows }) => (
            <div key={branch.id} className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Building2 size={14} className="text-muted-foreground" />
                {branch.nameAr}
                <span className="text-xs text-muted-foreground font-normal">({rows.length})</span>
              </h2>
              <div className="space-y-2">
                {rows.map((d) => (
                  <DoctorCard
                    key={d.id}
                    doctor={d}
                    branches={branches}
                    rooms={branch.rooms}
                    schedule={schedules[d.id] ?? []}
                    roomsAssigned={doctorRooms[d.id] ?? []}
                    cutoffs={laserCutoffs[d.id] ?? []}
                    menAreas={menAreas}
                    expanded={expandedId === d.id}
                    onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)}
                    onChanged={() => router.refresh()}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- create ---------------- */

function CreateDoctorForm({
  branches,
  onDone,
  onCancel,
}: {
  branches: AdminBranch[]
  onDone: () => void
  onCancel: () => void
}) {
  const [branchId, setBranchId] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [specialty, setSpecialty] = useState("")
  const [alwaysOpen, setAlwaysOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    const res = await createDoctorAction({
      branchId,
      code: "x", // ignored by the action (auto-generated); kept for the type
      displayName,
      specialty: specialty.trim() || null,
      notes: null,
      personKey: null,
      alwaysOpen,
      acceptsMen: true,
      laserMenAllowed: true,
      menLaserAreaCodes: null,
      rejectsSmallAreasOnly: false,
      noOverlap: false,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("اتعمل الدكتور")
      onDone()
    } else toast.error(res.error)
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h2 className="text-sm font-bold text-foreground">دكتور جديد</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>الفرع</Label>
          <select className={cn(SELECT_CLS, "w-full")} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">اختار الفرع</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nameAr}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>الاسم</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="د. هبة" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>التخصص (اختياري)</Label>
        <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={alwaysOpen} onChange={(e) => setAlwaysOpen(e.target.checked)} className="rounded" />
        <span>Open دايمًا</span>
      </label>
      <div className="flex gap-2 pt-1">
        <Button onClick={submit} loading={busy} disabled={!branchId || !displayName.trim()}>
          إنشاء
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </div>
  )
}

/* ---------------- row + tabs ---------------- */

type Tab = "info" | "rules" | "schedule" | "laser"

function DoctorCard({
  doctor,
  branches,
  rooms,
  schedule,
  roomsAssigned,
  cutoffs,
  menAreas,
  expanded,
  onToggle,
  onChanged,
}: {
  doctor: DoctorRow
  branches: AdminBranch[]
  rooms: { id: string; title: string }[]
  schedule: ScheduleEntry[]
  roomsAssigned: { weekday: number; roomId: string }[]
  cutoffs: { weekday: number; cutoff: string }[]
  menAreas: MenArea[]
  expanded: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [tab, setTab] = useState<Tab>("info")

  // info + rules share one state object (both save the whole doctor).
  const [branchId, setBranchId] = useState(doctor.branchId)
  const [displayName, setDisplayName] = useState(doctor.displayName)
  const [specialty, setSpecialty] = useState(doctor.specialty ?? "")
  const [notes, setNotes] = useState(doctor.notes ?? "")
  const [personKey, setPersonKey] = useState(doctor.personKey ?? "")
  const [alwaysOpen, setAlwaysOpen] = useState(doctor.alwaysOpen)
  const [acceptsMen, setAcceptsMen] = useState(doctor.acceptsMen)
  const [laserMenAllowed, setLaserMenAllowed] = useState(doctor.laserMenAllowed)
  const [menCodes, setMenCodes] = useState<string[]>(doctor.menLaserAreaCodes ?? [])
  const [rejectsSmall, setRejectsSmall] = useState(doctor.rejectsSmallAreasOnly)
  const [noOverlap, setNoOverlap] = useState(doctor.noOverlap)
  const [busy, setBusy] = useState(false)

  const buildInput = (): DoctorInput => ({
    branchId,
    code: "x", // ignored on update
    displayName,
    specialty: specialty.trim() || null,
    notes: notes.trim() || null,
    personKey: personKey.trim() || null,
    alwaysOpen,
    acceptsMen,
    laserMenAllowed,
    menLaserAreaCodes: menCodes.length > 0 ? menCodes : null,
    rejectsSmallAreasOnly: rejectsSmall,
    noOverlap,
  })

  const saveDoctor = async () => {
    setBusy(true)
    const res = await updateDoctorAction(doctor.id, buildInput())
    setBusy(false)
    if (res.ok) {
      toast.success("اتحدّث")
      onChanged()
    } else toast.error(res.error)
  }

  const toggleActive = async () => {
    setBusy(true)
    const res = await setDoctorActiveAction(doctor.id, !doctor.isActive)
    setBusy(false)
    if (res.ok) {
      toast.success(doctor.isActive ? "اتوقف" : "اترجّع")
      onChanged()
    } else toast.error(res.error)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "info", label: "البيانات" },
    { key: "rules", label: "القواعد" },
    { key: "schedule", label: "الجدول" },
    { key: "laser", label: "آخر ليزر" },
  ]

  return (
    <div className="bg-card border border-border rounded-xl">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-start">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{doctor.displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{doctor.specialty ?? "—"}</p>
        </div>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{
            backgroundColor: doctor.alwaysOpen ? "var(--status-open-bg)" : "var(--status-confirmed-bg)",
            color: doctor.alwaysOpen ? "var(--status-open)" : "var(--status-confirmed)",
          }}
        >
          {doctor.alwaysOpen ? "Open" : "Confirmed"}
        </span>
        {!doctor.isActive && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--status-breach-bg)] text-[var(--status-breach)] shrink-0">
            معطل
          </span>
        )}
        {expanded ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3">
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
                  <Label>الاسم</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>الفرع</Label>
                  <select className={cn(SELECT_CLS, "w-full")} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>التخصص</Label>
                  <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>person_key</Label>
                  <Input value={personKey} onChange={(e) => setPersonKey(e.target.value)} placeholder="نفس الشخص في فروع مختلفة" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>ملاحظات (يشمل الحد اليومي زي «٣٠ عميل في اليوم»)</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={saveDoctor} loading={busy}>
                  <Save size={14} className="me-1" /> حفظ
                </Button>
                <Button size="sm" variant={doctor.isActive ? "danger" : "secondary"} onClick={toggleActive} loading={busy}>
                  <Power size={14} className="me-1" />
                  {doctor.isActive ? "إيقاف" : "تفعيل"}
                </Button>
              </div>
            </div>
          )}

          {tab === "rules" && (
            <div className="space-y-2.5">
              <Flag label="Open دايمًا" checked={alwaysOpen} onChange={setAlwaysOpen} />
              <Flag label="بتعمل رجالة" checked={acceptsMen} onChange={setAcceptsMen} />
              {acceptsMen && <Flag label="ليزر رجالة" checked={laserMenAllowed} onChange={setLaserMenAllowed} />}
              {acceptsMen && laserMenAllowed && (
                <div className="space-y-1">
                  <Label>مناطق الرجالة المسموحة (فاضي = كل المناطق)</Label>
                  <div className="flex flex-wrap gap-1">
                    {menAreas.map((a) => (
                      <button
                        key={a.code}
                        type="button"
                        onClick={() =>
                          setMenCodes((c) => (c.includes(a.code) ? c.filter((x) => x !== a.code) : [...c, a.code]))
                        }
                        className={cn(
                          "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                          menCodes.includes(a.code)
                            ? "border-primary bg-accent text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {a.nameEn}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Flag label="مش بتاخد مناطق صغيرة لوحدها" checked={rejectsSmall} onChange={setRejectsSmall} />
              <Flag label="من غير أوفرلاب" checked={noOverlap} onChange={setNoOverlap} />
              <Button size="sm" onClick={saveDoctor} loading={busy}>
                <Save size={14} className="me-1" /> حفظ القواعد
              </Button>
            </div>
          )}

          {tab === "schedule" && (
            <ScheduleEditor
              doctorId={doctor.id}
              initialEntries={schedule}
              initialRooms={roomsAssigned}
              rooms={rooms}
              onSaved={onChanged}
            />
          )}

          {tab === "laser" && (
            <LaserCutoffsEditor doctorId={doctor.id} initial={cutoffs} onSaved={onChanged} />
          )}
        </div>
      )}
    </div>
  )
}

function Flag({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      <span className="text-foreground">{label}</span>
    </label>
  )
}

/* ---------------- laser cutoffs ---------------- */

function LaserCutoffsEditor({
  doctorId,
  initial,
  onSaved,
}: {
  doctorId: string
  initial: { weekday: number; cutoff: string }[]
  onSaved: () => void
}) {
  const [byDay, setByDay] = useState<Record<number, string>>(
    Object.fromEntries(initial.map((c) => [c.weekday, c.cutoff.slice(0, 5)]))
  )
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const cutoffs = Object.entries(byDay)
      .filter(([, t]) => t)
      .map(([day, t]) => ({ weekday: Number(day), cutoff: t }))
    setBusy(true)
    const res = await saveLaserCutoffsAction({ doctorId, cutoffs })
    setBusy(false)
    if (res.ok) {
      toast.success("اتحفظ آخر ليزر")
      onSaved()
    } else toast.error(res.error)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">آخر معاد ليزر في كل يوم (سيبه فاضي لو مفيش حد).</p>
      <div className="space-y-1.5">
        {DAY_LABELS.map((label, day) => (
          <div key={day} className="flex items-center gap-2">
            <span className="text-sm text-foreground w-14 shrink-0">{label}</span>
            <Input
              type="time"
              value={byDay[day] ?? ""}
              onChange={(e) => setByDay((m) => ({ ...m, [day]: e.target.value }))}
              className="w-32 h-8"
            />
            {byDay[day] && (
              <button
                type="button"
                onClick={() => setByDay((m) => ({ ...m, [day]: "" }))}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                مسح
              </button>
            )}
          </div>
        ))}
      </div>
      <Button size="sm" onClick={save} loading={busy}>
        <Save size={14} className="me-1" /> حفظ
      </Button>
    </div>
  )
}
