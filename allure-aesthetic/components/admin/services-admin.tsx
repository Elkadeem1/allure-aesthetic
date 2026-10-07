"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Wrench, Plus, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "cn"
import {
  createServiceAction,
  updateServiceAction,
  createLaserAreaAction,
  updateLaserAreaAction,
} from "@/app/(admin)/admin/actions"
import type { Database, ClientGender } from "@/lib/types/database.types"

type Service = Database["public"]["Tables"]["services"]["Row"]
type LaserArea = Database["public"]["Tables"]["laser_areas"]["Row"]
type LaserConflict = Database["public"]["Tables"]["laser_area_conflicts"]["Row"]
type LaserCombo = Database["public"]["Tables"]["laser_area_combos"]["Row"]

interface ServicesAdminProps {
  services: Service[]
  laserAreas: LaserArea[]
  laserConflicts: LaserConflict[]
  laserCombos: LaserCombo[]
}

export function ServicesAdmin({
  services: initial,
  laserAreas: initialAreas,
  laserConflicts,
  laserCombos,
}: ServicesAdminProps) {
  const [tab, setTab] = useState<"services" | "areas" | "conflicts" | "combos">("services")
  const [services, setServices] = useState(initial)
  const [laserAreas, setLaserAreas] = useState(initialAreas)

  const tabs = [
    { key: "services" as const, label: "الخدمات" },
    { key: "areas" as const, label: "مناطق الليزر" },
    { key: "conflicts" as const, label: "التعارضات" },
    { key: "combos" as const, label: "التجميعات" },
  ]

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Wrench size={20} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">الخدمات وبيانات الليزر</h1>
      </div>

      <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "services" && (
        <ServicesSection
          services={services}
          onUpdated={(s) => setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...s } : x)))}
        />
      )}
      {tab === "areas" && (
        <LaserAreasSection
          areas={laserAreas}
          onUpdated={(a) => setLaserAreas((prev) => prev.map((x) => (x.code === a.code ? { ...x, ...a } : x)))}
        />
      )}
      {tab === "conflicts" && <ConflictsSection conflicts={laserConflicts} areas={laserAreas} />}
      {tab === "combos" && <CombosSection combos={laserCombos} />}
    </div>
  )
}

// --- Services tab ---

function ServicesSection({
  services,
  onUpdated,
}: {
  services: Service[]
  onUpdated: (s: Partial<Service> & { id: string }) => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [code, setCode] = useState("")
  const [nameAr, setNameAr] = useState("")
  const [nameEn, setNameEn] = useState("")
  const [duration, setDuration] = useState(30)
  const [usesLaser, setUsesLaser] = useState(false)
  const [busy, setBusy] = useState(false)

  const resetForm = () => {
    setCode(""); setNameAr(""); setNameEn(""); setDuration(30); setUsesLaser(false)
    setShowCreate(false)
  }

  const handleCreate = async () => {
    setBusy(true)
    const res = await createServiceAction({ code, nameAr, nameEn, defaultDurationMin: duration, usesLaserAreas: usesLaser, kbSlug: null })
    setBusy(false)
    if (res.ok) { toast.success("تم إضافة الخدمة"); resetForm(); window.location.reload() }
    else toast.error(res.error)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant={showCreate ? "secondary" : "default"} onClick={() => setShowCreate(!showCreate)}>
          <Plus size={14} className="me-1" />خدمة جديدة
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">خدمة جديدة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>الكود</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
              <div className="space-y-1"><Label>الاسم (عربي)</Label><Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} /></div>
              <div className="space-y-1"><Label>الاسم (إنجليزي)</Label><Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></div>
              <div className="space-y-1"><Label>المدة (دقيقة)</Label><Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-20" /></div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={usesLaser} onChange={(e) => setUsesLaser(e.target.checked)} className="rounded" />
              <span>تستخدم مناطق ليزر</span>
            </label>
            <div className="flex gap-2"><Button size="sm" onClick={handleCreate} loading={busy}>إضافة</Button><Button size="sm" variant="secondary" onClick={resetForm}>إلغاء</Button></div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {services.map((s) => (
          <ServiceRow
            key={s.id}
            service={s}
            expanded={expandedId === s.id}
            onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
            onUpdated={onUpdated}
          />
        ))}
      </div>
    </div>
  )
}

function ServiceRow({ service, expanded, onToggle, onUpdated }: {
  service: Service; expanded: boolean; onToggle: () => void
  onUpdated: (s: Partial<Service> & { id: string }) => void
}) {
  const [code, setCode] = useState(service.code)
  const [nameAr, setNameAr] = useState(service.name_ar)
  const [nameEn, setNameEn] = useState(service.name_en)
  const [duration, setDuration] = useState(service.default_duration_min)
  const [usesLaser, setUsesLaser] = useState(service.uses_laser_areas)
  const [kbSlug, setKbSlug] = useState(service.kb_slug ?? "")
  const [isActive, setIsActive] = useState(service.is_active)
  const [sort, setSort] = useState(service.sort)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const res = await updateServiceAction({
      serviceId: service.id, code, nameAr, nameEn,
      defaultDurationMin: duration, usesLaserAreas: usesLaser,
      kbSlug: kbSlug || null, isActive, sort,
    })
    setBusy(false)
    if (res.ok) { toast.success("تم التحديث"); onUpdated({ id: service.id, name_ar: nameAr, is_active: isActive }) }
    else toast.error(res.error)
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-start">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{service.name_ar}</p>
          <p className="text-xs text-muted-foreground">{service.code} — {service.default_duration_min} دقيقة</p>
        </div>
        {service.uses_laser_areas && <Badge variant="outline" className="text-[10px]">ليزر</Badge>}
        <Badge variant={service.is_active ? "default" : "destructive"} className="text-[10px]">{service.is_active ? "فعالة" : "معطلة"}</Badge>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>الكود</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <div className="space-y-1"><Label>الاسم (عربي)</Label><Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} /></div>
            <div className="space-y-1"><Label>الاسم (إنجليزي)</Label><Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></div>
            <div className="space-y-1"><Label>المدة (دقيقة)</Label><Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-20" /></div>
            <div className="space-y-1"><Label>KB slug</Label><Input value={kbSlug} onChange={(e) => setKbSlug(e.target.value)} /></div>
            <div className="space-y-1"><Label>الترتيب</Label><Input type="number" value={sort} onChange={(e) => setSort(Number(e.target.value))} className="w-20" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={usesLaser} onChange={(e) => setUsesLaser(e.target.checked)} className="rounded" /><span>تستخدم مناطق ليزر</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" /><span>فعالة</span>
          </label>
          <Button size="sm" onClick={save} loading={busy}>حفظ</Button>
        </div>
      )}
    </div>
  )
}

// --- Laser areas tab ---

function LaserAreasSection({
  areas,
  onUpdated,
}: {
  areas: LaserArea[]
  onUpdated: (a: Partial<LaserArea> & { code: string }) => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const [filterGender, setFilterGender] = useState<ClientGender | "all">("all")

  const [newCode, setNewCode] = useState("")
  const [newGender, setNewGender] = useState<ClientGender>("female")
  const [newNameEn, setNewNameEn] = useState("")
  const [newHintAr, setNewHintAr] = useState("")
  const [newDuration, setNewDuration] = useState(15)
  const [newIsSmall, setNewIsSmall] = useState(false)
  const [newIsFullBody, setNewIsFullBody] = useState(false)
  const [newRequiresCompanion, setNewRequiresCompanion] = useState(false)
  const [busy, setBusy] = useState(false)

  const filtered = filterGender === "all" ? areas : areas.filter((a) => a.gender === filterGender)

  const resetForm = () => {
    setNewCode(""); setNewGender("female"); setNewNameEn(""); setNewHintAr("")
    setNewDuration(15); setNewIsSmall(false); setNewIsFullBody(false); setNewRequiresCompanion(false)
    setShowCreate(false)
  }

  const handleCreate = async () => {
    setBusy(true)
    const res = await createLaserAreaAction({
      code: newCode, gender: newGender, nameEn: newNameEn,
      hintAr: newHintAr || null, durationMin: newDuration,
      isSmall: newIsSmall, isFullBody: newIsFullBody, requiresCompanion: newRequiresCompanion,
    })
    setBusy(false)
    if (res.ok) { toast.success("تم إضافة المنطقة"); resetForm(); window.location.reload() }
    else toast.error(res.error)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select
          value={filterGender}
          onChange={(e) => setFilterGender(e.target.value as ClientGender | "all")}
          className="h-8 rounded-lg border border-input bg-background px-3 text-xs"
        >
          <option value="all">الكل</option>
          <option value="female">سيدات</option>
          <option value="male">رجال</option>
        </select>
        <Button size="sm" variant={showCreate ? "secondary" : "default"} onClick={() => setShowCreate(!showCreate)}>
          <Plus size={14} className="me-1" />منطقة جديدة
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">منطقة ليزر جديدة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>الكود</Label><Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="f_full_legs" /></div>
              <div className="space-y-1">
                <Label>الجنس</Label>
                <select value={newGender} onChange={(e) => setNewGender(e.target.value as ClientGender)} className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="female">سيدات</option>
                  <option value="male">رجال</option>
                </select>
              </div>
              <div className="space-y-1"><Label>الاسم (إنجليزي)</Label><Input value={newNameEn} onChange={(e) => setNewNameEn(e.target.value)} /></div>
              <div className="space-y-1"><Label>التلميح (عربي)</Label><Input value={newHintAr} onChange={(e) => setNewHintAr(e.target.value)} /></div>
              <div className="space-y-1"><Label>المدة (دقيقة)</Label><Input type="number" value={newDuration} onChange={(e) => setNewDuration(Number(e.target.value))} className="w-20" /></div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={newIsSmall} onChange={(e) => setNewIsSmall(e.target.checked)} className="rounded" /><span>صغيرة</span></label>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={newIsFullBody} onChange={(e) => setNewIsFullBody(e.target.checked)} className="rounded" /><span>فول بادي</span></label>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={newRequiresCompanion} onChange={(e) => setNewRequiresCompanion(e.target.checked)} className="rounded" /><span>تحتاج companion</span></label>
            </div>
            <div className="flex gap-2"><Button size="sm" onClick={handleCreate} loading={busy}>إضافة</Button><Button size="sm" variant="secondary" onClick={resetForm}>إلغاء</Button></div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((a) => (
          <LaserAreaRow
            key={a.code}
            area={a}
            expanded={expandedCode === a.code}
            onToggle={() => setExpandedCode(expandedCode === a.code ? null : a.code)}
            onUpdated={onUpdated}
          />
        ))}
      </div>
    </div>
  )
}

function LaserAreaRow({ area, expanded, onToggle, onUpdated }: {
  area: LaserArea; expanded: boolean; onToggle: () => void
  onUpdated: (a: Partial<LaserArea> & { code: string }) => void
}) {
  const [nameEn, setNameEn] = useState(area.name_en)
  const [hintAr, setHintAr] = useState(area.hint_ar ?? "")
  const [duration, setDuration] = useState(area.duration_min)
  const [isSmall, setIsSmall] = useState(area.is_small)
  const [isFullBody, setIsFullBody] = useState(area.is_full_body)
  const [requiresCompanion, setRequiresCompanion] = useState(area.requires_companion)
  const [sort, setSort] = useState(area.sort)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const res = await updateLaserAreaAction({
      code: area.code, nameEn, hintAr: hintAr || null,
      durationMin: duration, isSmall, isFullBody, requiresCompanion, sort,
    })
    setBusy(false)
    if (res.ok) { toast.success("تم التحديث"); onUpdated({ code: area.code, name_en: nameEn }) }
    else toast.error(res.error)
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-start">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{area.name_en}</p>
          <p className="text-xs text-muted-foreground">{area.code} — {area.duration_min} دقيقة</p>
        </div>
        <Badge variant="outline" className="text-[10px]">{area.gender === "female" ? "سيدات" : "رجال"}</Badge>
        {area.is_small && <Badge variant="secondary" className="text-[10px]">صغيرة</Badge>}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>الاسم (إنجليزي)</Label><Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></div>
            <div className="space-y-1"><Label>التلميح (عربي)</Label><Input value={hintAr} onChange={(e) => setHintAr(e.target.value)} /></div>
            <div className="space-y-1"><Label>المدة (دقيقة)</Label><Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-20" /></div>
            <div className="space-y-1"><Label>الترتيب</Label><Input type="number" value={sort} onChange={(e) => setSort(Number(e.target.value))} className="w-20" /></div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={isSmall} onChange={(e) => setIsSmall(e.target.checked)} className="rounded" /><span>صغيرة</span></label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={isFullBody} onChange={(e) => setIsFullBody(e.target.checked)} className="rounded" /><span>فول بادي</span></label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={requiresCompanion} onChange={(e) => setRequiresCompanion(e.target.checked)} className="rounded" /><span>تحتاج companion</span></label>
          </div>
          <Button size="sm" onClick={save} loading={busy}>حفظ</Button>
        </div>
      )}
    </div>
  )
}

// --- Conflicts tab (read-only view) ---

function ConflictsSection({ conflicts, areas }: { conflicts: LaserConflict[]; areas: LaserArea[] }) {
  const areaName = (code: string) => areas.find((a) => a.code === code)?.name_en ?? code

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">تعارضات مناطق الليزر — المناطق اللي مينفعش تتحجز مع بعض في نفس الجلسة.</p>
      {conflicts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">مفيش تعارضات</p>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-start px-4 py-2.5 font-medium">المنطقة</th>
                <th className="text-start px-4 py-2.5 font-medium">تتعارض مع</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((c, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5">{areaName(c.area_code)}</td>
                  <td className="px-4 py-2.5">{areaName(c.conflicts_with)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// --- Combos tab (read-only view) ---

function CombosSection({ combos }: { combos: LaserCombo[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">تجميعات مناطق الليزر — قواعد تعديل المدة لما يتحجزوا مع بعض.</p>
      {combos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">مفيش تجميعات</p>
      ) : (
        <div className="space-y-2">
          {combos.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-foreground">{c.label}</p>
              <p className="text-xs text-muted-foreground">
                مطلوب: {c.required_codes.join("، ")}
                {c.any_of_codes.length > 0 ? ` — أي من: ${c.any_of_codes.join("، ")}` : ""}
                {" — "}تعديل المدة: {c.duration_adjust_min > 0 ? "+" : ""}{c.duration_adjust_min} دقيقة
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
