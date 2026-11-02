"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Save,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  DoorOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "cn"
import { DAY_LABELS } from "@/lib/admin/doctor-schema"
import {
  updateBranchAction,
  saveRoomsAction,
  saveBranchCutoffsAction,
} from "@/app/(admin)/admin/branches/actions"

export type RoomRow = { id: string | null; code: string; title: string; sort: number; isActive: boolean }
export type CutoffRow = { weekday: number; shiftStartsBefore: string; cutoff: string }
export type BranchRow = {
  id: string
  nameAr: string
  address: string | null
  paymentMethods: string[]
  managers: string[]
  bookingRules: string[]
  hasTickets: boolean
  logoUrl: string | null
  isActive: boolean
  rooms: RoomRow[]
  cutoffs: CutoffRow[]
}

export function BranchesAdmin({ branches }: { branches: BranchRow[] }) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <Building2 size={20} className="text-primary" />
        <h1 className="text-xl font-bold text-foreground">Branches</h1>
        <span className="text-sm text-muted-foreground">({branches.length})</span>
      </div>
      <div className="space-y-2">
        {branches.map((b) => (
          <BranchCard
            key={b.id}
            branch={b}
            expanded={expandedId === b.id}
            onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)}
            onChanged={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  )
}

/* ---------------- chip / list editors ---------------- */

function ChipsEditor({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const t = draft.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft("")
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {value.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted text-foreground rounded-full ps-2.5 pe-1 py-0.5">
            {v}
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="p-0.5 rounded-full hover:bg-background">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="h-8"
        />
        <Button type="button" size="sm" variant="secondary" onClick={add}>
          <Plus size={13} />
        </Button>
      </div>
    </div>
  )
}

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const copy = [...arr]
  ;[copy[i], copy[j]] = [copy[j], copy[i]]
  return copy
}

function OrderedListEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const t = draft.trim()
    if (t) onChange([...value, t])
    setDraft("")
  }
  return (
    <div className="space-y-1.5">
      {value.map((line, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground w-5 tabular shrink-0">{i + 1}.</span>
          <Input
            value={line}
            onChange={(e) => onChange(value.map((x, idx) => (idx === i ? e.target.value : x)))}
            className="h-8 flex-1"
          />
          <button type="button" onClick={() => onChange(move(value, i, -1))} disabled={i === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ArrowUp size={13} />
          </button>
          <button type="button" onClick={() => onChange(move(value, i, 1))} disabled={i === value.length - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ArrowDown size={13} />
          </button>
          <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="p-1 text-[var(--status-breach)] hover:bg-[var(--status-breach-bg)] rounded">
            <X size={13} />
          </button>
        </div>
      ))}
      <div className="flex gap-1.5">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder="سطر قاعدة حجز جديد…" className="h-8" />
        <Button type="button" size="sm" variant="secondary" onClick={add}>
          <Plus size={13} />
        </Button>
      </div>
    </div>
  )
}

/* ---------------- branch card ---------------- */

type Tab = "info" | "rooms" | "cutoffs"

function BranchCard({
  branch,
  expanded,
  onToggle,
  onChanged,
}: {
  branch: BranchRow
  expanded: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [tab, setTab] = useState<Tab>("info")

  // info
  const [nameAr, setNameAr] = useState(branch.nameAr)
  const [address, setAddress] = useState(branch.address ?? "")
  const [paymentMethods, setPaymentMethods] = useState(branch.paymentMethods)
  const [managers, setManagers] = useState(branch.managers)
  const [bookingRules, setBookingRules] = useState(branch.bookingRules)
  const [hasTickets, setHasTickets] = useState(branch.hasTickets)
  const [logoUrl, setLogoUrl] = useState(branch.logoUrl ?? "")
  const [isActive, setIsActive] = useState(branch.isActive)
  const [busy, setBusy] = useState(false)

  const saveInfo = async () => {
    setBusy(true)
    const res = await updateBranchAction({
      branchId: branch.id,
      nameAr,
      address: address.trim() || null,
      paymentMethods,
      managers,
      bookingRules,
      hasTickets,
      logoUrl: logoUrl.trim() || null,
      isActive,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("اتحدّث الفرع")
      onChanged()
    } else toast.error(res.error)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "info", label: "البيانات" },
    { key: "rooms", label: "الغرف" },
    { key: "cutoffs", label: "ليزر الفرع" },
  ]

  return (
    <div className="bg-card border border-border rounded-xl">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-start">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{branch.nameAr}</p>
          <p className="text-xs text-muted-foreground truncate">{branch.address ?? "—"}</p>
        </div>
        {branch.hasTickets && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--status-request-bg)] text-[var(--status-request)] shrink-0">
            تيكتات
          </span>
        )}
        {!branch.isActive && (
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
                  <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>العنوان</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>لوجو (مسار)</Label>
                <Input dir="ltr" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="/brand/innova-logo.svg" />
              </div>
              <div className="space-y-1">
                <Label>طرق الدفع</Label>
                <ChipsEditor value={paymentMethods} onChange={setPaymentMethods} placeholder="كاش، فيزا…" />
              </div>
              <div className="space-y-1">
                <Label>المسؤولين</Label>
                <ChipsEditor value={managers} onChange={setManagers} placeholder="اسم المسؤول…" />
              </div>
              <div className="space-y-1">
                <Label>قواعد الحجز</Label>
                <OrderedListEditor value={bookingRules} onChange={setBookingRules} />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={hasTickets} onChange={(e) => setHasTickets(e.target.checked)} className="rounded" />
                <span className="text-foreground">عنده تيكتات</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
                <span className="text-foreground">فعال</span>
              </label>
              <Button size="sm" onClick={saveInfo} loading={busy}>
                <Save size={14} className="me-1" /> حفظ
              </Button>
            </div>
          )}

          {tab === "rooms" && <RoomsEditor branchId={branch.id} initial={branch.rooms} onSaved={onChanged} />}
          {tab === "cutoffs" && <CutoffsEditor branchId={branch.id} initial={branch.cutoffs} onSaved={onChanged} />}
        </div>
      )}
    </div>
  )
}

/* ---------------- rooms ---------------- */

function RoomsEditor({ branchId, initial, onSaved }: { branchId: string; initial: RoomRow[]; onSaved: () => void }) {
  const [rooms, setRooms] = useState<RoomRow[]>(initial)
  const [busy, setBusy] = useState(false)

  const patch = (i: number, p: Partial<RoomRow>) => setRooms((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)))
  const addRoom = () =>
    setRooms((rs) => [...rs, { id: null, code: `r${rs.length + 1}`, title: "", sort: rs.length, isActive: true }])
  const reorder = (i: number, dir: -1 | 1) => setRooms((rs) => move(rs, i, dir).map((r, idx) => ({ ...r, sort: idx })))

  const save = async () => {
    setBusy(true)
    const res = await saveRoomsAction({ branchId, rooms: rooms.map((r, idx) => ({ ...r, sort: idx })) })
    setBusy(false)
    if (res.ok) {
      toast.success("اتحفظت الغرف")
      onSaved()
    } else toast.error(res.error)
  }

  return (
    <div className="space-y-2">
      {rooms.length === 0 && <p className="text-xs text-muted-foreground">مفيش غرف للفرع ده.</p>}
      {rooms.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className={cn("flex items-center gap-1.5", !r.isActive && "opacity-50")}>
          <DoorOpen size={14} className="text-muted-foreground shrink-0" />
          <Input value={r.code} onChange={(e) => patch(i, { code: e.target.value })} className="h-8 w-20" placeholder="كود" dir="ltr" />
          <Input value={r.title} onChange={(e) => patch(i, { title: e.target.value })} className="h-8 flex-1" placeholder="اسم الغرفة" />
          <button type="button" onClick={() => reorder(i, -1)} disabled={i === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ArrowUp size={13} />
          </button>
          <button type="button" onClick={() => reorder(i, 1)} disabled={i === rooms.length - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ArrowDown size={13} />
          </button>
          <button
            type="button"
            onClick={() => patch(i, { isActive: !r.isActive })}
            className={cn("text-[11px] px-2 py-1 rounded-lg border", r.isActive ? "border-border text-muted-foreground hover:bg-muted" : "border-[var(--status-confirmed)] text-[var(--status-confirmed)]")}
          >
            {r.isActive ? "إيقاف" : "تفعيل"}
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <Button type="button" size="sm" variant="secondary" onClick={addRoom}>
          <Plus size={13} className="me-1" /> غرفة
        </Button>
        <Button size="sm" onClick={save} loading={busy}>
          <Save size={14} className="me-1" /> حفظ الغرف
        </Button>
      </div>
    </div>
  )
}

/* ---------------- branch laser cutoffs ---------------- */

function CutoffsEditor({ branchId, initial, onSaved }: { branchId: string; initial: CutoffRow[]; onSaved: () => void }) {
  const [byDay, setByDay] = useState<Record<number, { before: string; cutoff: string }>>(
    Object.fromEntries(initial.map((c) => [c.weekday, { before: c.shiftStartsBefore.slice(0, 5), cutoff: c.cutoff.slice(0, 5) }]))
  )
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const cutoffs = Object.entries(byDay)
      .filter(([, v]) => v.before && v.cutoff)
      .map(([day, v]) => ({ weekday: Number(day), shiftStartsBefore: v.before, cutoff: v.cutoff }))
    setBusy(true)
    const res = await saveBranchCutoffsAction({ branchId, cutoffs })
    setBusy(false)
    if (res.ok) {
      toast.success("اتحفظ كت أوف الليزر")
      onSaved()
    } else toast.error(res.error)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        الشيفتات اللي بتبدأ قبل وقت معيّن — آخر ليزر فيها. سيب اليوم فاضي لو مفيش قاعدة.
      </p>
      <div className="space-y-1.5">
        {DAY_LABELS.map((label, day) => {
          const v = byDay[day] ?? { before: "", cutoff: "" }
          const set = (p: Partial<{ before: string; cutoff: string }>) =>
            setByDay((m) => ({ ...m, [day]: { ...v, ...p } }))
          return (
            <div key={day} className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-foreground w-14 shrink-0">{label}</span>
              <span className="text-[11px] text-muted-foreground">يبدأ قبل</span>
              <Input type="time" value={v.before} onChange={(e) => set({ before: e.target.value })} className="w-28 h-8" />
              <span className="text-[11px] text-muted-foreground">آخر ليزر</span>
              <Input type="time" value={v.cutoff} onChange={(e) => set({ cutoff: e.target.value })} className="w-28 h-8" />
            </div>
          )
        })}
      </div>
      <Button size="sm" onClick={save} loading={busy}>
        <Save size={14} className="me-1" /> حفظ
      </Button>
    </div>
  )
}
