"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Tag,
  Upload,
  Pencil,
  Plus,
  Save,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  History,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "cn"
import { formatNumber } from "@/lib/format"
import { gdNorm } from "@/lib/arabic"
import type { ImportDiff } from "@/lib/admin/prices/diff"
import {
  previewPriceImportAction,
  applyPriceImportAction,
  setItemBranchPriceAction,
  updatePriceItemAction,
  createPriceItemAction,
  updateCategoryStartsFromAction,
  type PreviewResult,
} from "@/app/(admin)/admin/prices/actions"

export type PriceCat = { id: string; code: string; nameAr: string; startsFrom: number | null }
export type PriceBranch = { id: string; code: string; nameAr: string }
export type PriceItemRow = {
  id: string
  code: string
  categoryId: string
  fullName: string
  groupName: string | null
  variant: string | null
  unit: string | null
  notes: string | null
  itemType: "service" | "addon"
  isActive: boolean
  priceText: string | null
  prices: Record<string, number> // branchId -> price
}
export type ImportRow = {
  id: string
  fileName: string | null
  createdAt: string
  by: string | null
  newItems: number
  changedItems: number
  deactivatedItems: number
}

const SELECT_CLS = "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground"

export function PricesAdmin({
  categories,
  items,
  branches,
  imports,
}: {
  categories: PriceCat[]
  items: PriceItemRow[]
  branches: PriceBranch[]
  imports: ImportRow[]
}) {
  const [tab, setTab] = useState<"upload" | "manual">("manual")

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center gap-2">
        <Tag size={20} className="text-primary" />
        <h1 className="text-xl font-bold text-foreground">Prices</h1>
      </div>

      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {([
          ["manual", "تعديل يدوي"],
          ["upload", "رفع ملف Excel"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "upload" ? (
        <UploadPanel imports={imports} />
      ) : (
        <ManualPanel categories={categories} items={items} branches={branches} />
      )}
    </div>
  )
}

/* ==================== UPLOAD ==================== */

function UploadPanel({ imports }: { imports: ImportRow[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<PreviewResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)

  const onPick = async (file: File) => {
    setBusy(true)
    setResult(null)
    const fd = new FormData()
    fd.append("file", file)
    const res = await previewPriceImportAction(fd)
    setBusy(false)
    setResult(res)
    if (!res.ok) toast.error(res.error)
  }

  const apply = async () => {
    if (!result || !result.ok) return
    setApplying(true)
    const res = await applyPriceImportAction({ model: result.model, fileName: result.fileName })
    setApplying(false)
    if (res.ok) {
      toast.success("اتطبّقت الأسعار")
      setResult(null)
      if (fileRef.current) fileRef.current.value = ""
      router.refresh()
    } else toast.error(res.error)
  }

  const hasErrors = result?.ok && result.errors.length > 0
  const canApply = result?.ok && result.errors.length === 0

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm text-muted-foreground">
          ارفع ملف الأسعار (نفس شكل <span className="font-mono text-xs">price-list.xlsx</span>). هيتعمل preview
          الأول قبل ما يتطبّق. بنود Innova (INV-) مش بتتأثر بالرفع.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPick(f)
          }}
        />
        <Button onClick={() => fileRef.current?.click()} loading={busy}>
          <Upload size={15} className="me-1" /> اختار ملف Excel
        </Button>
        {result?.ok && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <FileSpreadsheet size={13} /> {result.fileName}
          </p>
        )}
      </div>

      {/* Validation errors */}
      {hasErrors && result.ok && (
        <div className="bg-[var(--status-breach-bg)] border border-[var(--status-breach)]/30 rounded-xl p-4 space-y-2">
          <p className="text-sm font-bold text-[var(--status-breach)] flex items-center gap-1.5">
            <AlertTriangle size={15} /> في مشاكل في الملف ({result.errors.length}) — صلّحها وارفع تاني:
          </p>
          <ul className="space-y-1 text-xs text-foreground max-h-60 overflow-y-auto">
            {result.errors.map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[var(--status-breach)] shrink-0">•</span>
                <span>
                  <span className="font-medium">{e.sheet}</span>
                  {e.row > 0 && <span className="text-muted-foreground"> (صف {e.row})</span>}: {e.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview */}
      {canApply && result.ok && <PreviewBlock diff={result.diff} onApply={apply} applying={applying} />}

      {/* History */}
      <div className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <History size={15} className="text-muted-foreground" /> آخر 10 عمليات رفع
        </h2>
        {imports.length === 0 ? (
          <p className="text-xs text-muted-foreground">مفيش عمليات رفع لسه.</p>
        ) : (
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {imports.map((im) => (
              <div key={im.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <FileSpreadsheet size={14} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{im.fileName ?? "—"}</p>
                  <p className="text-muted-foreground">
                    {new Date(im.createdAt).toLocaleString("ar-EG-u-nu-latn", { dateStyle: "medium", timeStyle: "short" })}
                    {im.by ? ` · ${im.by}` : ""}
                  </p>
                </div>
                <span className="text-muted-foreground tabular shrink-0">
                  +{im.newItems} جديد · {im.changedItems} اتغير · {im.deactivatedItems} اتوقف
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CountCard({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="flex-1 bg-card border border-border rounded-xl p-3 text-center">
      <p className="text-2xl font-bold tabular" style={{ color }}>
        {formatNumber(n)}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

function PreviewBlock({ diff, onApply, applying }: { diff: ImportDiff; onApply: () => void; applying: boolean }) {
  const fmt = (p: number | null) => (p === null ? "—" : p === 0 ? "مجانًا" : formatNumber(p))
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <CountCard n={diff.counts.newItems} label="بنود جديدة" color="var(--status-confirmed)" />
        <CountCard n={diff.counts.changedItems} label="بنود اتغيّرت" color="var(--status-open)" />
        <CountCard n={diff.counts.deactivatedItems} label="هتتوقف" color="var(--status-notice)" />
      </div>

      {diff.changes.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-xs font-semibold text-foreground">
            الأسعار اللي هتتغير ({formatNumber(diff.changes.length)}) — الأحمر = تغيير أكبر من 30%
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="text-start font-medium px-3 py-1.5">الكود</th>
                  <th className="text-start font-medium px-3 py-1.5">البند</th>
                  <th className="text-start font-medium px-3 py-1.5">الفرع</th>
                  <th className="text-end font-medium px-3 py-1.5">قبل</th>
                  <th className="text-end font-medium px-3 py-1.5">بعد</th>
                  <th className="text-end font-medium px-3 py-1.5">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {diff.changes.map((c, i) => (
                  <tr key={i} className={cn(c.big && "bg-[var(--status-breach-bg)]")}>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">{c.code}</td>
                    <td className="px-3 py-1.5 text-foreground">{c.item}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{c.branchName}</td>
                    <td className="px-3 py-1.5 text-end tabular text-muted-foreground">{fmt(c.oldPrice)}</td>
                    <td className="px-3 py-1.5 text-end tabular font-semibold text-foreground">{fmt(c.newPrice)}</td>
                    <td
                      className={cn("px-3 py-1.5 text-end tabular", c.big ? "text-[var(--status-breach)] font-bold" : "text-muted-foreground")}
                    >
                      {c.pct === null ? "—" : `${c.pct > 0 ? "+" : ""}${Math.round(c.pct)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Button onClick={onApply} loading={applying}>
        <CheckCircle2 size={15} className="me-1" /> طبّق
      </Button>
    </div>
  )
}

/* ==================== MANUAL ==================== */

function ManualPanel({
  categories,
  items,
  branches,
}: {
  categories: PriceCat[]
  items: PriceItemRow[]
  branches: PriceBranch[]
}) {
  const [catId, setCatId] = useState(categories[0]?.id ?? "")
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "")
  const [query, setQuery] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  // local item store so inline edits stay without a full refresh
  const [store, setStore] = useState(items)

  const cat = categories.find((c) => c.id === catId)
  const list = useMemo(() => {
    const q = gdNorm(query)
    return store
      .filter((i) => i.categoryId === catId)
      .filter((i) => !q || gdNorm(`${i.fullName} ${i.code}`).includes(q))
  }, [store, catId, query])

  const patchItem = (id: string, patch: Partial<PriceItemRow>) =>
    setStore((s) => s.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  return (
    <div className="space-y-4">
      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCatId(c.id)}
            className={cn(
              "text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
              c.id === catId
                ? "border-primary bg-accent text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            {c.nameAr}
          </button>
        ))}
      </div>

      {/* Branch + search + category starts_from */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={SELECT_CLS} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nameAr}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 h-9 flex-1 min-w-[160px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="دور على بند…"
            className="flex-1 text-sm bg-transparent outline-none text-foreground"
            dir="rtl"
          />
        </div>
        <Button variant="secondary" onClick={() => setShowAdd((s) => !s)}>
          <Plus size={14} className="me-1" /> بند جديد
        </Button>
      </div>

      {cat && <CategoryStartsFrom key={cat.id} cat={cat} />}

      {showAdd && cat && (
        <AddItemForm categoryId={cat.id} onDone={() => setShowAdd(false)} />
      )}

      {/* Items */}
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">مفيش بنود في القسم ده.</p>
      ) : (
        <div className="space-y-2">
          {list.map((it) => (
            <ItemRow
              key={`${it.id}:${branchId}`}
              item={it}
              branchId={branchId}
              onPatch={(p) => patchItem(it.id, p)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryStartsFrom({ cat }: { cat: PriceCat }) {
  const [val, setVal] = useState(cat.startsFrom === null ? "" : String(cat.startsFrom))
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    const res = await updateCategoryStartsFromAction({
      categoryId: cat.id,
      startsFrom: val.trim() === "" ? null : Number(val),
    })
    setBusy(false)
    if (res.ok) toast.success("اتحفظ «يبدأ من»")
    else toast.error(res.error)
  }
  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
      <Label className="text-xs text-muted-foreground shrink-0">«يبدأ من» للقسم (فاضي = تلقائي)</Label>
      <Input
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="h-8 w-28"
        placeholder="تلقائي"
      />
      <Button size="sm" onClick={save} loading={busy}>
        حفظ
      </Button>
    </div>
  )
}

function AddItemForm({ categoryId, onDone }: { categoryId: string; onDone: () => void }) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [fullName, setFullName] = useState("")
  const [groupName, setGroupName] = useState("")
  const [variant, setVariant] = useState("")
  const [unit, setUnit] = useState("")
  const [itemType, setItemType] = useState<"service" | "addon">("service")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    const res = await createPriceItemAction({
      categoryId,
      code,
      fullName,
      groupName: groupName || null,
      variant: variant || null,
      unit: unit || null,
      itemType,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("اتضاف البند")
      onDone()
      router.refresh()
    } else toast.error(res.error)
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-bold text-foreground">بند جديد</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>الكود (مطلوب)</Label>
          <Input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="FIL-99" />
        </div>
        <div className="space-y-1">
          <Label>الاسم الكامل</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>المجموعة</Label>
          <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>النوع/المنطقة</Label>
          <Input value={variant} onChange={(e) => setVariant(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>الوحدة</Label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>النوع</Label>
          <select className={cn(SELECT_CLS, "w-full")} value={itemType} onChange={(e) => setItemType(e.target.value as "service" | "addon")}>
            <option value="service">خدمة</option>
            <option value="addon">إضافة</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} loading={busy} disabled={!code.trim() || !fullName.trim()}>
          إضافة
        </Button>
        <Button size="sm" variant="secondary" onClick={onDone}>
          إلغاء
        </Button>
      </div>
    </div>
  )
}

function ItemRow({
  item,
  branchId,
  onPatch,
}: {
  item: PriceItemRow
  branchId: string
  onPatch: (patch: Partial<PriceItemRow>) => void
}) {
  const current = item.prices[branchId]
  // Keyed by `${id}:${branchId}` in the parent, so this remounts (and reseeds)
  // when the selected branch changes.
  const [price, setPrice] = useState(current === undefined ? "" : String(current))
  const [priceBusy, setPriceBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [unit, setUnit] = useState(item.unit ?? "")
  const [notes, setNotes] = useState(item.notes ?? "")
  const [isActive, setIsActive] = useState(item.isActive)
  const [metaBusy, setMetaBusy] = useState(false)

  const savePrice = async () => {
    const trimmed = price.trim()
    const value = trimmed === "" ? null : Number(trimmed)
    setPriceBusy(true)
    const res = await setItemBranchPriceAction({ itemId: item.id, branchId, price: value })
    setPriceBusy(false)
    if (res.ok) {
      toast.success("اتحفظ السعر")
      onPatch({
        prices: value === null ? omit(item.prices, branchId) : { ...item.prices, [branchId]: value },
      })
    } else toast.error(res.error)
  }

  const saveMeta = async () => {
    setMetaBusy(true)
    const res = await updatePriceItemAction({
      itemId: item.id,
      unit: unit || null,
      notes: notes || null,
      isActive,
    })
    setMetaBusy(false)
    if (res.ok) {
      toast.success("اتحدّث البند")
      onPatch({ unit: unit || null, notes: notes || null, isActive })
      setOpen(false)
    } else toast.error(res.error)
  }

  return (
    <div className={cn("bg-card border border-border rounded-xl p-3", !item.isActive && "opacity-60")}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {item.fullName}
            {item.code.startsWith("INV-") && (
              <span className="ms-1.5 text-[10px] px-1.5 py-0.5 rounded bg-[var(--rose-tint)] text-[var(--rose-deep)]">Innova</span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono">{item.code}</p>
        </div>
        {item.priceText ? (
          <span className="text-xs text-muted-foreground">{item.priceText}</span>
        ) : (
          <>
            <Input
              data-price-id={item.id}
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="غير متاح"
              className="h-8 w-28 text-end"
            />
            <span className="text-[11px] text-muted-foreground w-10">
              {price.trim() === "" ? "غير متاح" : Number(price) === 0 ? "مجانًا" : "ج"}
            </span>
            <Button size="sm" onClick={savePrice} loading={priceBusy}>
              <Save size={13} />
            </Button>
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
          title="تفاصيل"
        >
          <Pencil size={14} />
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>الوحدة</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="h-8" placeholder="سرنجة / نبضة…" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>ملاحظات</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer col-span-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
            <span className="text-foreground">البند فعّال</span>
          </label>
          <div className="col-span-2">
            <Button size="sm" onClick={saveMeta} loading={metaBusy}>
              <Save size={13} className="me-1" /> حفظ
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function omit(obj: Record<string, number>, key: string): Record<string, number> {
  const { [key]: _drop, ...rest } = obj
  return rest
}
