"use client"

import { Search, ExternalLink } from "lucide-react"
import { formatEgp } from "@/lib/format"
import type { PriceCategoryData, KbArticle } from "./types"

const PACKAGE_SUFFIX = " - باكدج 3 جلسات"

function isLaserCategory(cat: PriceCategoryData) {
  return cat.items.some((i) => i.name.endsWith(PACKAGE_SUFFIX))
}

function formatPrice(price: number | null, priceText: string | null) {
  if (priceText) return priceText
  if (price === null) return "—"
  return formatEgp(price)
}

type Props = {
  categories: PriceCategoryData[]
  search: string
  onSearch: (v: string) => void
  kbArticles: KbArticle[]
  onKbOpen: (slug: string) => void
}

export function PriceCatalogue({ categories, search, onSearch, kbArticles, onKbOpen }: Props) {
  const q = search.trim().toLowerCase()

  const filtered = categories
    .map((cat) => ({
      ...cat,
      items: q
        ? cat.items.filter((i) => i.name.toLowerCase().includes(q))
        : cat.items,
    }))
    .filter((cat) => cat.items.length > 0)

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header + search */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground shrink-0">قائمة الأسعار</h2>
        <div className="flex-1 flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-1.5">
          <Search size={13} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="ابحث عن خدمة..."
            className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            dir="rtl"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          لا توجد نتائج
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((cat) => (
            <CategorySection
              key={cat.id}
              category={cat}
              kbArticle={cat.kbSlug ? kbArticles.find((a) => a.slug === cat.kbSlug) : undefined}
              onKbOpen={onKbOpen}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function CategorySection({
  category,
  kbArticle,
  onKbOpen,
}: {
  category: PriceCategoryData
  kbArticle?: KbArticle
  onKbOpen: (slug: string) => void
}) {
  const isLaser = isLaserCategory(category)

  return (
    <div>
      {/* Category title */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30">
        <h3 className="text-xs font-semibold text-foreground">{category.name}</h3>
        {kbArticle && (
          <button
            onClick={() => onKbOpen(category.kbSlug!)}
            className="text-primary/70 hover:text-primary transition-colors"
            title="عرض المعلومات"
          >
            <ExternalLink size={12} />
          </button>
        )}
        {category.infoNote && (
          <span className="text-[11px] text-muted-foreground ms-auto">{category.infoNote}</span>
        )}
      </div>

      {isLaser ? (
        <LaserTable items={category.items} />
      ) : (
        <SimpleTable items={category.items} />
      )}
    </div>
  )
}

function LaserTable({ items }: { items: PriceCategoryData["items"] }) {
  // Pair single + package by base name
  const singles = items.filter((i) => !i.name.endsWith(PACKAGE_SUFFIX))
  const packages = new Map(
    items
      .filter((i) => i.name.endsWith(PACKAGE_SUFFIX))
      .map((i) => [i.name.slice(0, -PACKAGE_SUFFIX.length), i])
  )

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border/60">
          <th className="text-end px-4 py-1.5 font-medium text-muted-foreground">المنطقة</th>
          <th className="text-center px-3 py-1.5 font-medium text-muted-foreground w-24">جلسة واحدة</th>
          <th className="text-center px-3 py-1.5 font-medium text-muted-foreground w-28">باكدج 3 جلسات</th>
        </tr>
      </thead>
      <tbody>
        {singles.map((item) => {
          const pkg = packages.get(item.name)
          return (
            <tr key={item.id} className="border-b border-border/40 hover:bg-muted/20">
              <td className="px-4 py-2 text-foreground">{item.name}</td>
              <td className="px-3 py-2 text-center tabular text-foreground">
                {formatPrice(item.price, item.priceText)}
              </td>
              <td className="px-3 py-2 text-center tabular text-foreground">
                {pkg ? formatPrice(pkg.price, pkg.priceText) : "—"}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function SimpleTable({ items }: { items: PriceCategoryData["items"] }) {
  return (
    <table className="w-full text-xs">
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-b border-border/40 hover:bg-muted/20">
            <td className="px-4 py-2 text-foreground">{item.name}</td>
            <td className="px-4 py-2 text-end tabular text-foreground font-medium">
              {formatPrice(item.price, item.priceText)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
