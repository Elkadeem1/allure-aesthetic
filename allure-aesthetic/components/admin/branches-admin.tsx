"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Building2, Plus, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "cn"
import {
  createBranchAction,
  updateBranchAction,
  updateBranchPoliciesAction,
  updateBranchServicesAction,
  saveBranchLaserCutoffsAction,
} from "@/app/(admin)/admin/actions"
import type { Database } from "@/lib/types/database.types"

type Branch = Database["public"]["Tables"]["branches"]["Row"]
type Policy = Database["public"]["Tables"]["branch_policies"]["Row"]
type BranchCutoff = Database["public"]["Tables"]["branch_laser_cutoffs"]["Row"]

const DAY_LABELS = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]

interface BranchesAdminProps {
  branches: Branch[]
  policies: Policy[]
  priceLists: Array<{ id: string; code: string; name: string }>
  services: Array<{ id: string; code: string; name_ar: string }>
  branchServices: Array<{ branch_id: string; service_id: string }>
  branchCutoffs: BranchCutoff[]
}

export function BranchesAdmin({
  branches: initial,
  policies: initialPolicies,
  priceLists,
  services,
  branchServices: initialBs,
  branchCutoffs: initialCutoffs,
}: BranchesAdminProps) {
  const [branches, setBranches] = useState(initial)
  const [policies] = useState(initialPolicies)
  const [branchServices] = useState(initialBs)
  const [branchCutoffs] = useState(initialCutoffs)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [code, setCode] = useState("")
  const [nameAr, setNameAr] = useState("")
  const [address, setAddress] = useState("")
  const [paymentMethods, setPaymentMethods] = useState("")
  const [priceListId, setPriceListId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const resetForm = () => {
    setCode("")
    setNameAr("")
    setAddress("")
    setPaymentMethods("")
    setPriceListId(null)
    setShowCreate(false)
  }

  const handleCreate = async () => {
    setBusy(true)
    const res = await createBranchAction({
      code,
      nameAr,
      address: address || null,
      paymentMethods: paymentMethods.split("،").map((s) => s.trim()).filter(Boolean),
      priceListId,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("تم إنشاء الفرع")
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
          <Building2 size={20} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">الفروع</h1>
          <Badge variant="secondary" className="text-xs">{branches.length}</Badge>
        </div>
        <Button
          variant={showCreate ? "secondary" : "default"}
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus size={14} className="me-1" />
          فرع جديد
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">فرع جديد</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>الكود</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="maadi" />
              </div>
              <div className="space-y-1">
                <Label>الاسم</Label>
                <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="المعادي" />
              </div>
              <div className="space-y-1">
                <Label>العنوان</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>طرق الدفع (مفصولة بفاصلة)</Label>
                <Input value={paymentMethods} onChange={(e) => setPaymentMethods(e.target.value)} placeholder="كاش، فيزا" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>قائمة الأسعار</Label>
              <select
                value={priceListId ?? ""}
                onChange={(e) => setPriceListId(e.target.value || null)}
                className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">بدون</option>
                {priceLists.map((pl) => (
                  <option key={pl.id} value={pl.id}>{pl.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleCreate} loading={busy}>إنشاء</Button>
              <Button size="sm" variant="secondary" onClick={resetForm}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {branches.map((b) => (
          <BranchRow
            key={b.id}
            branch={b}
            policy={policies.find((p) => p.branch_id === b.id)}
            priceLists={priceLists}
            services={services}
            branchServiceIds={branchServices.filter((bs) => bs.branch_id === b.id).map((bs) => bs.service_id)}
            cutoffs={branchCutoffs.filter((c) => c.branch_id === b.id)}
            expanded={expandedId === b.id}
            onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)}
            onUpdated={(updated) => {
              setBranches((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
            }}
          />
        ))}
      </div>
    </div>
  )
}

function BranchRow({
  branch,
  policy,
  priceLists,
  services,
  branchServiceIds,
  cutoffs,
  expanded,
  onToggle,
  onUpdated,
}: {
  branch: Branch
  policy?: Policy
  priceLists: Array<{ id: string; code: string; name: string }>
  services: Array<{ id: string; code: string; name_ar: string }>
  branchServiceIds: string[]
  cutoffs: BranchCutoff[]
  expanded: boolean
  onToggle: () => void
  onUpdated: (b: Partial<Branch> & { id: string }) => void
}) {
  const [tab, setTab] = useState<"info" | "policies" | "services" | "cutoffs">("info")

  // Info fields
  const [code, setCode] = useState(branch.code)
  const [nameAr, setNameAr] = useState(branch.name_ar)
  const [address, setAddress] = useState(branch.address ?? "")
  const [paymentMethods, setPaymentMethods] = useState(branch.payment_methods.join("، "))
  const [priceListId, setPriceListId] = useState<string | null>(branch.price_list_id)
  const [isActive, setIsActive] = useState(branch.is_active)
  const [sort, setSort] = useState(branch.sort)
  const [busy, setBusy] = useState(false)

  // Policy fields
  const [requestWindow, setRequestWindow] = useState(policy?.request_window_days ?? 2)
  const [sameDayAlways, setSameDayAlways] = useState(policy?.same_day_always_request ?? true)
  const [autoConfirm, setAutoConfirm] = useState<number[]>(policy?.auto_confirm_weekdays ?? [])
  const [allowOverlap, setAllowOverlap] = useState(policy?.allow_overlap ?? false)
  const [bookingRules, setBookingRules] = useState((policy?.booking_rules ?? []).join("\n"))
  const [policyBusy, setPolicyBusy] = useState(false)

  // Services
  const [selectedServices, setSelectedServices] = useState<string[]>(branchServiceIds)
  const [svcBusy, setSvcBusy] = useState(false)

  const saveInfo = async () => {
    setBusy(true)
    const res = await updateBranchAction({
      branchId: branch.id,
      code,
      nameAr,
      address: address || null,
      paymentMethods: paymentMethods.split("،").map((s) => s.trim()).filter(Boolean),
      priceListId,
      isActive,
      sort,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("تم التحديث")
      onUpdated({ id: branch.id, code, name_ar: nameAr, is_active: isActive })
    } else {
      toast.error(res.error)
    }
  }

  const savePolicies = async () => {
    setPolicyBusy(true)
    const res = await updateBranchPoliciesAction({
      branchId: branch.id,
      requestWindowDays: requestWindow,
      sameDayAlwaysRequest: sameDayAlways,
      autoConfirmWeekdays: autoConfirm,
      allowOverlap,
      bookingRules: bookingRules.split("\n").map((s) => s.trim()).filter(Boolean),
    })
    setPolicyBusy(false)
    if (res.ok) toast.success("تم حفظ السياسات")
    else toast.error(res.error)
  }

  const saveServices = async () => {
    setSvcBusy(true)
    const res = await updateBranchServicesAction({ branchId: branch.id, serviceIds: selectedServices })
    setSvcBusy(false)
    if (res.ok) toast.success("تم حفظ الخدمات")
    else toast.error(res.error)
  }

  const toggleAutoConfirm = (day: number) => {
    setAutoConfirm((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day])
  }

  const toggleService = (id: string) => {
    setSelectedServices((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])
  }

  const tabs = [
    { key: "info" as const, label: "البيانات" },
    { key: "policies" as const, label: "السياسات" },
    { key: "services" as const, label: "الخدمات" },
  ]

  return (
    <div className="bg-card border border-border rounded-xl">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-start">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{branch.name_ar}</p>
          <p className="text-xs text-muted-foreground">{branch.code} — ترتيب {branch.sort}</p>
        </div>
        <Badge variant={branch.is_active ? "default" : "destructive"} className="text-[10px]">
          {branch.is_active ? "فعال" : "معطل"}
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
                  <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>العنوان</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>الترتيب</Label>
                  <Input type="number" value={sort} onChange={(e) => setSort(Number(e.target.value))} className="w-20" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>طرق الدفع (مفصولة بفاصلة)</Label>
                <Input value={paymentMethods} onChange={(e) => setPaymentMethods(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>قائمة الأسعار</Label>
                <select
                  value={priceListId ?? ""}
                  onChange={(e) => setPriceListId(e.target.value || null)}
                  className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">بدون</option>
                  {priceLists.map((pl) => (
                    <option key={pl.id} value={pl.id}>{pl.name}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
                <span>فعال</span>
              </label>
              <Button size="sm" onClick={saveInfo} loading={busy}>حفظ</Button>
            </div>
          )}

          {tab === "policies" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>نافذة الطلبات (أيام)</Label>
                  <Input type="number" value={requestWindow} onChange={(e) => setRequestWindow(Number(e.target.value))} className="w-20" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={sameDayAlways} onChange={(e) => setSameDayAlways(e.target.checked)} className="rounded" />
                <span>نفس اليوم دايمًا طلب</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={allowOverlap} onChange={(e) => setAllowOverlap(e.target.checked)} className="rounded" />
                <span>السماح بالتداخل</span>
              </label>
              <div className="space-y-1">
                <Label>أيام التأكيد التلقائي</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => toggleAutoConfirm(i)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                        autoConfirm.includes(i)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>قواعد الحجز (سطر لكل قاعدة)</Label>
                <textarea
                  value={bookingRules}
                  onChange={(e) => setBookingRules(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
                />
              </div>
              <Button size="sm" onClick={savePolicies} loading={policyBusy}>حفظ السياسات</Button>
            </div>
          )}

          {tab === "services" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {services.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => toggleService(s.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                      selectedServices.includes(s.id)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {s.name_ar}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={saveServices} loading={svcBusy}>حفظ الخدمات</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
