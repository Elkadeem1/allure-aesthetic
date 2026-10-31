"use client"

import { useState } from "react"
import { Search, ChevronDown, ExternalLink } from "lucide-react"
import { cn } from "cn"
import { formatEgp, formatNumber } from "@/lib/format"
import type { PriceCategoryData, PriceItemData, LaserTable, LaserRow, KbArticle } from "./types"

const money = (n: number) => (n === 0 ? "مجانًا" : formatEgp(n))

function priceCell(price: number | null, unit: string | null, priceText: string | null): string {
  if (priceText) return priceText
  if (price === null) return "—"
  if (unit === "نبضة") return `${formatNumber(price)} ج / نبضة`
  return money(price)
}

const laserCell = (n: number | null) => (n === null ? "—" : money(n))

type Props = {
  categories: PriceCategoryData[]
  laserTable: LaserTable | null
  initialOpen?: string
  search: string
  onSearch: (v: string) => void
  kbArticles: KbArticle[]
  onKbOpen: (slug: string) => void
}

export function PriceCatalogue({ categories, laserTable, initialOpen, search, onSearch, kbArticles, onKbOpen }: Props) {
  const [openCodes, setOpenCodes] = useState<Set<string>>(
    () => new Set(initialOpen && categories.some((c) => c.code === initialOpen) ? [initialOpen] : [])
  )
  const q = search.trim().toLowerCase()

  const hasMatch = (cat: PriceCategoryData): boolean => {
    if (!q) return false
    if (cat.code === "LSR" && laserTable) {
      const inRows = (rows: LaserRow[]) => rows.some((r) => r.label.toLowerCase().includes(q))
      return inRows(laserTable.women) || inRows(laserTable.men) || laserTable.extras.some((e) => e.label.toLowerCase().includes(q))
    }
    return cat.items.some((it) => it.name.toLowerCase().includes(q))
  }

  // When searching, only show categories that match; otherwise show all.
  const visible = q ? categories.filter(hasMatch) : categories
  const isOpen = (cat: PriceCategoryData) => openCodes.has(cat.code) || (q ? hasMatch(cat) : false)

  const toggle = (code: string) =>
    setOpenCodes((prev) => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground shrink-0">قائمة الأسعار</h2>
        <div className="flex-1 flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-1.5">
          <Search size={13} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="ابحث في كل الأقسام..."
            className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            dir="rtl"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">لا توجد نتائج</div>
      ) : (
        <div className="p-4 space-y-3">
          {/* category buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {visible.map((cat) => {
              const open = isOpen(cat)
              return (
                <button
                  key={cat.code}
                  onClick={() => toggle(cat.code)}
                  className={cn(
                    "text-start rounded-xl border p-3 transition-colors",
                    open ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-foreground leading-tight">{cat.name}</span>
                    <ChevronDown size={14} className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                  </div>
                  {cat.startsFrom != null && (
                    <div className="mt-1 text-[11px] font-medium text-primary tabular">يبدأ من {formatEgp(cat.startsFrom)}</div>
                  )}
                  <div className="mt-0.5 text-[10px] text-muted-foreground tabular">{formatNumber(cat.items.length)} بند</div>
                </button>
              )
            })}
          </div>

          {/* opened bodies, right under the grid */}
          {visible.filter(isOpen).map((cat) => {
            const kb = cat.kbSlug ? kbArticles.find((a) => a.slug === cat.kbSlug) : undefined
            const openKb = () => cat.kbSlug && onKbOpen(cat.kbSlug)
            return (
              <div key={cat.code} className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40">
                  <h3 className="text-xs font-bold text-foreground">{cat.name}</h3>
                  {kb && cat.kbSlug && (
                    <button onClick={openKb} className="text-primary/70 hover:text-primary transition-colors" title="عرض المعلومات">
                      <ExternalLink size={12} />
                    </button>
                  )}
                  {cat.startsFrom != null && (
                    <span className="ms-auto text-[11px] font-medium text-primary tabular">يبدأ من {formatEgp(cat.startsFrom)}</span>
                  )}
                </div>
                {cat.code === "LSR" && laserTable ? (
                  <LaserBody table={laserTable} q={q} onRowClick={openKb} />
                ) : (
                  <GenericBody items={cat.items} q={q} onRowClick={openKb} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ---------- laser body (women / men / extras) ---------- */

function LaserBody({ table, q, onRowClick }: { table: LaserTable; q: string; onRowClick: () => void }) {
  const filterRows = (rows: LaserRow[]) => (q ? rows.filter((r) => r.label.toLowerCase().includes(q)) : rows)
  const women = filterRows(table.women)
  const men = filterRows(table.men)
  const extras = q ? table.extras.filter((e) => e.label.toLowerCase().includes(q)) : table.extras

  const AreaTable = ({ title, rows }: { title: string; rows: LaserRow[] }) =>
    rows.length === 0 ? null : (
      <div>
        <div className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground bg-muted/20">{title}</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground">
              <th className="text-start px-4 py-1.5 font-medium">المنطقة</th>
              <th className="text-center px-3 py-1.5 font-medium w-28">جلسة واحدة</th>
              <th className="text-center px-3 py-1.5 font-medium w-28">باكدج ٣ جلسات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} onClick={onRowClick} className="border-b border-border/40 hover:bg-muted/20 cursor-pointer">
                <td className="px-4 py-2 text-foreground">
                  {r.label}
                  {r.isBundle && <span className="ms-1.5 text-[10px] px-1.5 py-0.5 rounded bg-[var(--sage-tint)] text-[var(--sage)] font-medium">باقة</span>}
                </td>
                <td className="px-3 py-2 text-center tabular text-foreground">{laserCell(r.single)}</td>
                <td className="px-3 py-2 text-center tabular text-foreground">{laserCell(r.package3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

  return (
    <div className="divide-y divide-border">
      <AreaTable title="سيدات" rows={women} />
      <AreaTable title="رجال" rows={men} />
      {extras.length > 0 && (
        <div>
          <div className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground bg-muted/20">النبضة والباكدجات</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="text-start px-4 py-1.5 font-medium">البند</th>
                <th className="text-start px-3 py-1.5 font-medium w-24">الوحدة</th>
                <th className="text-end px-4 py-1.5 font-medium w-28">السعر</th>
              </tr>
            </thead>
            <tbody>
              {extras.map((e) => (
                <tr key={e.code} onClick={onRowClick} className="border-b border-border/40 hover:bg-muted/20 cursor-pointer">
                  <td className="px-4 py-2 text-foreground">
                    {e.label}
                    {e.isAddon && <span className="ms-1.5 text-[10px] px-1.5 py-0.5 rounded bg-[var(--status-notice-bg)] text-[var(--status-notice)] font-medium">إضافة</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{e.unit ?? "—"}</td>
                  <td className="px-4 py-2 text-end tabular text-foreground font-medium">{priceCell(e.price, e.unit, e.priceText)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ---------- generic body (grouped by group_name) ---------- */

function GenericBody({ items, q, onRowClick }: { items: PriceItemData[]; q: string; onRowClick: () => void }) {
  const filtered = q ? items.filter((it) => it.name.toLowerCase().includes(q)) : items

  // Group by group_name, preserving first-seen order.
  const groups: { name: string | null; items: PriceItemData[] }[] = []
  const index = new Map<string, number>()
  for (const it of filtered) {
    const key = it.groupName ?? ""
    let gi = index.get(key)
    if (gi === undefined) {
      gi = groups.length
      index.set(key, gi)
      groups.push({ name: it.groupName, items: [] })
    }
    groups[gi].items.push(it)
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border/60 text-muted-foreground">
          <th className="text-start px-4 py-1.5 font-medium">البند</th>
          <th className="text-start px-3 py-1.5 font-medium w-24">الوحدة</th>
          <th className="text-end px-4 py-1.5 font-medium w-28">السعر</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g, gi) => (
          <GroupRows key={gi} group={g} onRowClick={onRowClick} />
        ))}
      </tbody>
    </table>
  )
}

function GroupRows({ group, onRowClick }: { group: { name: string | null; items: PriceItemData[] }; onRowClick: () => void }) {
  return (
    <>
      {group.name && (
        <tr className="bg-muted/20">
          <td colSpan={3} className="px-4 py-1.5 text-[11px] font-semibold text-foreground">{group.name}</td>
        </tr>
      )}
      {group.items.map((it) => (
        <tr key={it.code} onClick={onRowClick} className="border-b border-border/40 hover:bg-muted/20 cursor-pointer align-top">
          <td className="px-4 py-2 text-foreground">
            {it.variant ?? it.name}
            {it.notes && <div className="text-[10px] text-muted-foreground mt-0.5">{it.notes}</div>}
          </td>
          <td className="px-3 py-2 text-muted-foreground">{it.unit ?? "—"}</td>
          <td className="px-4 py-2 text-end tabular text-foreground font-medium">{priceCell(it.price, it.unit, it.priceText)}</td>
        </tr>
      ))}
    </>
  )
}
