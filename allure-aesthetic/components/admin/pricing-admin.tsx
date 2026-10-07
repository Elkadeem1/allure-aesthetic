"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CreditCard, Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "cn"
import { formatEgp } from "@/lib/format"
import {
  createPriceListAction,
  updatePriceListAction,
  createPriceCategoryAction,
  updatePriceCategoryAction,
  deletePriceCategoryAction,
  createPriceItemAction,
  updatePriceItemAction,
  deletePriceItemAction,
  saveConsultationPricesAction,
} from "@/app/(admin)/admin/actions"
import type { Database, ConsultationKind } from "@/lib/types/database.types"

type PriceList = Database["public"]["Tables"]["price_lists"]["Row"]
type PriceCategory = Database["public"]["Tables"]["price_categories"]["Row"]
type PriceItem = Database["public"]["Tables"]["price_items"]["Row"]
type LaserPriceMap = Database["public"]["Tables"]["laser_price_map"]["Row"]
type ConsultationPrice = Database["public"]["Tables"]["consultation_prices"]["Row"]

const CONSULTATION_KINDS: Array<{ key: ConsultationKind; label: string }> = [
  { key: "derma", label: "جلدية" },
  { key: "hair", label: "شعر" },
  { key: "derma_hair", label: "جلدية + شعر" },
  { key: "recons", label: "تجميل" },
  { key: "pulse", label: "نبضات" },
]

interface PricingAdminProps {
  priceLists: PriceList[]
  categories: PriceCategory[]
  items: PriceItem[]
  laserPriceMap: LaserPriceMap[]
  branches: Array<{ id: string; nameAr: string; priceListId: string | null }>
  consultationPrices: ConsultationPrice[]
  doctors: Array<{ id: string; displayName: string; branchId: string }>
}

export function PricingAdmin({
  priceLists: initialLists,
  categories: initialCats,
  items: initialItems,
  laserPriceMap,
  branches,
  consultationPrices: initialConsult,
  doctors,
}: PricingAdminProps) {
  const [tab, setTab] = useState<"lists" | "consultations" | "laser">("lists")
  const [priceLists, setPriceLists] = useState(initialLists)
  const [categories, setCategories] = useState(initialCats)
  const [items, setItems] = useState(initialItems)
  const [consultPrices] = useState(initialConsult)

  const tabs = [
    { key: "lists" as const, label: "قوائم الأسعار" },
    { key: "consultations" as const, label: "أسعار الكشف" },
    { key: "laser" as const, label: "ربط أسعار الليزر" },
  ]

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <CreditCard size={20} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">الأسعار</h1>
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

      {tab === "lists" && (
        <PriceListsSection
          priceLists={priceLists}
          categories={categories}
          items={items}
          onListUpdated={(l) => setPriceLists((prev) => prev.map((x) => (x.id === l.id ? { ...x, ...l } : x)))}
          onCategoryUpdated={(c) => setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...c } : x)))}
          onCategoryDeleted={(id) => setCategories((prev) => prev.filter((x) => x.id !== id))}
          onItemUpdated={(i) => setItems((prev) => prev.map((x) => (x.id === i.id ? { ...x, ...i } : x)))}
          onItemDeleted={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
        />
      )}
      {tab === "consultations" && (
        <ConsultationsSection
          branches={branches}
          doctors={doctors}
          consultPrices={consultPrices}
        />
      )}
      {tab === "laser" && (
        <LaserPriceSection laserPriceMap={laserPriceMap} items={items} />
      )}
    </div>
  )
}

// --- Price lists ---

function PriceListsSection({
  priceLists,
  categories,
  items,
  onListUpdated,
  onCategoryUpdated,
  onCategoryDeleted,
  onItemUpdated,
  onItemDeleted,
}: {
  priceLists: PriceList[]
  categories: PriceCategory[]
  items: PriceItem[]
  onListUpdated: (l: Partial<PriceList> & { id: string }) => void
  onCategoryUpdated: (c: Partial<PriceCategory> & { id: string }) => void
  onCategoryDeleted: (id: string) => void
  onItemUpdated: (i: Partial<PriceItem> & { id: string }) => void
  onItemDeleted: (id: string) => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newCode, setNewCode] = useState("")
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState(false)

  const handleCreate = async () => {
    setBusy(true)
    const res = await createPriceListAction({ code: newCode, name: newName })
    setBusy(false)
    if (res.ok) { toast.success("تم إنشاء قائمة الأسعار"); setNewCode(""); setNewName(""); setShowCreate(false); window.location.reload() }
    else toast.error(res.error)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant={showCreate ? "secondary" : "default"} onClick={() => setShowCreate(!showCreate)}>
          <Plus size={14} className="me-1" />قائمة جديدة
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">قائمة أسعار جديدة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>الكود</Label><Input value={newCode} onChange={(e) => setNewCode(e.target.value)} /></div>
              <div className="space-y-1"><Label>الاسم</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
            </div>
            <div className="flex gap-2"><Button size="sm" onClick={handleCreate} loading={busy}>إنشاء</Button><Button size="sm" variant="secondary" onClick={() => setShowCreate(false)}>إلغاء</Button></div>
          </CardContent>
        </Card>
      )}

      {priceLists.map((pl) => (
        <PriceListRow
          key={pl.id}
          priceList={pl}
          categories={categories.filter((c) => c.price_list_id === pl.id)}
          allItems={items}
          expanded={expandedId === pl.id}
          onToggle={() => setExpandedId(expandedId === pl.id ? null : pl.id)}
          onUpdated={onListUpdated}
          onCategoryUpdated={onCategoryUpdated}
          onCategoryDeleted={onCategoryDeleted}
          onItemUpdated={onItemUpdated}
          onItemDeleted={onItemDeleted}
        />
      ))}
    </div>
  )
}

function PriceListRow({
  priceList,
  categories,
  allItems,
  expanded,
  onToggle,
  onUpdated,
  onCategoryUpdated,
  onCategoryDeleted,
  onItemUpdated,
  onItemDeleted,
}: {
  priceList: PriceList
  categories: PriceCategory[]
  allItems: PriceItem[]
  expanded: boolean
  onToggle: () => void
  onUpdated: (l: Partial<PriceList> & { id: string }) => void
  onCategoryUpdated: (c: Partial<PriceCategory> & { id: string }) => void
  onCategoryDeleted: (id: string) => void
  onItemUpdated: (i: Partial<PriceItem> & { id: string }) => void
  onItemDeleted: (id: string) => void
}) {
  const [code, setCode] = useState(priceList.code)
  const [name, setName] = useState(priceList.name)
  const [busy, setBusy] = useState(false)
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [catBusy, setCatBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const res = await updatePriceListAction({ priceListId: priceList.id, code, name })
    setBusy(false)
    if (res.ok) { toast.success("تم التحديث"); onUpdated({ id: priceList.id, code, name }) }
    else toast.error(res.error)
  }

  const addCategory = async () => {
    setCatBusy(true)
    const res = await createPriceCategoryAction({ priceListId: priceList.id, name: newCatName, infoNote: null, kbSlug: null })
    setCatBusy(false)
    if (res.ok) { toast.success("تم إضافة الفئة"); setNewCatName(""); setShowAddCat(false); window.location.reload() }
    else toast.error(res.error)
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-start">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{priceList.name}</p>
          <p className="text-xs text-muted-foreground">{priceList.code} — {categories.length} فئة</p>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          <Separator />
          <div className="flex items-end gap-3">
            <div className="space-y-1 flex-1"><Label>الكود</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <div className="space-y-1 flex-1"><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <Button size="sm" onClick={save} loading={busy}>حفظ</Button>
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">الفئات</p>
            <Button size="sm" variant="secondary" onClick={() => setShowAddCat(!showAddCat)}>
              <Plus size={12} className="me-1" />فئة جديدة
            </Button>
          </div>

          {showAddCat && (
            <div className="flex items-center gap-2">
              <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="اسم الفئة" className="flex-1" />
              <Button size="sm" onClick={addCategory} loading={catBusy}>إضافة</Button>
            </div>
          )}

          {categories.map((cat) => (
            <CategoryBlock
              key={cat.id}
              category={cat}
              items={allItems.filter((i) => i.category_id === cat.id)}
              onUpdated={onCategoryUpdated}
              onDeleted={onCategoryDeleted}
              onItemUpdated={onItemUpdated}
              onItemDeleted={onItemDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryBlock({
  category,
  items,
  onUpdated,
  onDeleted,
  onItemUpdated,
  onItemDeleted,
}: {
  category: PriceCategory
  items: PriceItem[]
  onUpdated: (c: Partial<PriceCategory> & { id: string }) => void
  onDeleted: (id: string) => void
  onItemUpdated: (i: Partial<PriceItem> & { id: string }) => void
  onItemDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState(category.name)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemName, setNewItemName] = useState("")
  const [newItemPrice, setNewItemPrice] = useState("")
  const [itemBusy, setItemBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const res = await updatePriceCategoryAction({ categoryId: category.id, name, infoNote: category.info_note, kbSlug: category.kb_slug, sort: category.sort })
    setBusy(false)
    if (res.ok) { toast.success("تم التحديث"); onUpdated({ id: category.id, name }) }
    else toast.error(res.error)
  }

  const handleDelete = async () => {
    if (items.length > 0) { toast.error("احذف البنود الأول"); return }
    setBusy(true)
    const res = await deletePriceCategoryAction(category.id)
    setBusy(false)
    if (res.ok) { toast.success("تم حذف الفئة"); onDeleted(category.id) }
    else toast.error(res.error)
  }

  const addItem = async () => {
    setItemBusy(true)
    const res = await createPriceItemAction({
      categoryId: category.id,
      name: newItemName,
      price: newItemPrice ? Number(newItemPrice) : null,
      priceText: null,
    })
    setItemBusy(false)
    if (res.ok) { toast.success("تم إضافة البند"); setNewItemName(""); setNewItemPrice(""); setShowAddItem(false); window.location.reload() }
    else toast.error(res.error)
  }

  return (
    <div className="border border-border rounded-lg">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-2 text-start">
        <span className="text-sm font-medium text-foreground flex-1">{category.name}</span>
        <Badge variant="secondary" className="text-[10px]">{items.length} بند</Badge>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={save} loading={busy}>حفظ</Button>
            {!confirmDelete ? (
              <Button size="icon-sm" variant="ghost" onClick={() => setConfirmDelete(true)} className="text-destructive"><Trash2 size={12} /></Button>
            ) : (
              <Button size="sm" variant="danger" onClick={handleDelete} loading={busy}>تأكيد الحذف</Button>
            )}
          </div>

          {items.map((item) => (
            <ItemRow key={item.id} item={item} onUpdated={onItemUpdated} onDeleted={onItemDeleted} />
          ))}

          {showAddItem ? (
            <div className="flex items-center gap-2">
              <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="اسم البند" className="flex-1" />
              <Input type="number" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} placeholder="السعر" className="w-24" />
              <Button size="sm" onClick={addItem} loading={itemBusy}>إضافة</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setShowAddItem(true)} className="text-xs">
              <Plus size={12} className="me-1" />بند جديد
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, onUpdated, onDeleted }: {
  item: PriceItem
  onUpdated: (i: Partial<PriceItem> & { id: string }) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [price, setPrice] = useState(item.price?.toString() ?? "")
  const [priceText, setPriceText] = useState(item.price_text ?? "")
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async () => {
    setBusy(true)
    const res = await updatePriceItemAction({
      itemId: item.id, name, price: price ? Number(price) : null,
      priceText: priceText || null, sort: item.sort,
    })
    setBusy(false)
    if (res.ok) { toast.success("تم التحديث"); onUpdated({ id: item.id, name, price: price ? Number(price) : null }); setEditing(false) }
    else toast.error(res.error)
  }

  const handleDelete = async () => {
    setBusy(true)
    const res = await deletePriceItemAction(item.id)
    setBusy(false)
    if (res.ok) { toast.success("تم حذف البند"); onDeleted(item.id) }
    else toast.error(res.error)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-2 py-1.5">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
        <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="السعر" className="w-24" />
        <Input value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="نص السعر" className="w-28" />
        <Button size="sm" onClick={save} loading={busy}>حفظ</Button>
        <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>إلغاء</Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 group">
      <span className="text-sm flex-1">{item.name}</span>
      <span className="text-sm text-muted-foreground tabular">
        {item.price != null ? formatEgp(item.price) : item.price_text ?? "—"}
      </span>
      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
        <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">تعديل</button>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="text-xs text-destructive hover:underline">حذف</button>
        ) : (
          <button onClick={handleDelete} className="text-xs text-destructive font-bold">تأكيد</button>
        )}
      </div>
    </div>
  )
}

// --- Consultations section ---

function ConsultationsSection({
  branches,
  doctors,
  consultPrices,
}: {
  branches: Array<{ id: string; nameAr: string; priceListId: string | null }>
  doctors: Array<{ id: string; displayName: string; branchId: string }>
  consultPrices: ConsultationPrice[]
}) {
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id ?? "")
  const branchDoctors = doctors.filter((d) => d.branchId === selectedBranch)
  const branchPrices = consultPrices.filter((p) => p.branch_id === selectedBranch)

  const [editPrices, setEditPrices] = useState<Array<{ doctorId: string | null; kind: ConsultationKind; price: number }>>([])
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const startEdit = () => {
    setEditPrices(
      branchPrices.map((p) => ({ doctorId: p.doctor_id, kind: p.kind, price: p.price }))
    )
    setEditing(true)
  }

  const save = async () => {
    setBusy(true)
    const res = await saveConsultationPricesAction({ branchId: selectedBranch, prices: editPrices })
    setBusy(false)
    if (res.ok) { toast.success("تم حفظ أسعار الكشف"); setEditing(false); window.location.reload() }
    else toast.error(res.error)
  }

  const updatePrice = (idx: number, price: number) => {
    setEditPrices((prev) => prev.map((p, i) => (i === idx ? { ...p, price } : p)))
  }

  const addPrice = () => {
    setEditPrices((prev) => [...prev, { doctorId: null, kind: "derma", price: 0 }])
  }

  const removePrice = (idx: number) => {
    setEditPrices((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label>الفرع</Label>
        <select
          value={selectedBranch}
          onChange={(e) => { setSelectedBranch(e.target.value); setEditing(false) }}
          className="h-8 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.nameAr}</option>
          ))}
        </select>
      </div>

      {!editing ? (
        <>
          {branchPrices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">مفيش أسعار كشف محددة للفرع ده</p>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-start px-4 py-2.5 font-medium">النوع</th>
                    <th className="text-start px-4 py-2.5 font-medium">الدكتورة</th>
                    <th className="text-start px-4 py-2.5 font-medium">السعر</th>
                  </tr>
                </thead>
                <tbody>
                  {branchPrices.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2.5">{CONSULTATION_KINDS.find((k) => k.key === p.kind)?.label ?? p.kind}</td>
                      <td className="px-4 py-2.5">{p.doctor_id ? doctors.find((d) => d.id === p.doctor_id)?.displayName ?? "—" : "الفرع (عام)"}</td>
                      <td className="px-4 py-2.5 tabular">{formatEgp(p.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Button size="sm" onClick={startEdit}>تعديل أسعار الكشف</Button>
        </>
      ) : (
        <div className="space-y-3">
          {editPrices.map((ep, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={ep.kind}
                onChange={(e) => setEditPrices((prev) => prev.map((p, i) => (i === idx ? { ...p, kind: e.target.value as ConsultationKind } : p)))}
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
              >
                {CONSULTATION_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>{k.label}</option>
                ))}
              </select>
              <select
                value={ep.doctorId ?? ""}
                onChange={(e) => setEditPrices((prev) => prev.map((p, i) => (i === idx ? { ...p, doctorId: e.target.value || null } : p)))}
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs flex-1"
              >
                <option value="">الفرع (عام)</option>
                {branchDoctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.displayName}</option>
                ))}
              </select>
              <Input
                type="number"
                value={ep.price}
                onChange={(e) => updatePrice(idx, Number(e.target.value))}
                className="w-24"
              />
              <Button size="icon-sm" variant="ghost" onClick={() => removePrice(idx)} className="text-destructive">
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={addPrice}><Plus size={12} className="me-1" />سعر جديد</Button>
            <Button size="sm" onClick={save} loading={busy}>حفظ</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>إلغاء</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Laser price map (read-only view) ---

function LaserPriceSection({ laserPriceMap, items }: { laserPriceMap: LaserPriceMap[]; items: PriceItem[] }) {
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? id

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">ربط مناطق الليزر ببنود قائمة الأسعار — الجلسة المفردة و باقة 3 جلسات.</p>
      {laserPriceMap.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">مفيش ربط أسعار ليزر</p>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-start px-4 py-2.5 font-medium">المناطق</th>
                <th className="text-start px-4 py-2.5 font-medium">جلسة مفردة</th>
                <th className="text-start px-4 py-2.5 font-medium">3 جلسات</th>
              </tr>
            </thead>
            <tbody>
              {laserPriceMap.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5 text-xs">{m.area_codes.join("، ")}</td>
                  <td className="px-4 py-2.5">{itemName(m.single_item_id)}</td>
                  <td className="px-4 py-2.5">{m.package3_item_id ? itemName(m.package3_item_id) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
