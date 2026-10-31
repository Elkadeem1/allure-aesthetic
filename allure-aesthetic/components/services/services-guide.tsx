"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, ChevronDown, MapPin, Tag } from "lucide-react"
import { cn } from "cn"
import { gdNorm } from "@/lib/arabic"

export type Svc = {
  id: string
  name: string
  branch?: string | null
  summary: string
  details: [string, string][]
  products: [string, string, string][]
  booking: string[]
  care: [string, string][]
  say: [string, string][]
  escalate: string
  review: string[]
}

// service id -> price category code (to open its prices on Branches).
const SVC_CAT: Record<string, string> = {
  derma_consult: "CON",
  laser_hair: "LSR",
  fractional: "CO2",
  laser_vascular: "VEN",
  filler_face: "FIL",
  filler_body: "BFL",
  filler_calcium: "CAF",
  botox: "BTX",
  skinbooster: "SKB",
  plla: "PLA",
  exosomes: "EXO",
  meso: "MES",
  prp: "PRP",
  gcell: "GCL",
  threads: "THR",
  hifu: "HIF",
  dermapen: "DPN",
  vivace: "VIV",
  cleansing: "SKC",
  peeling: "PEL",
  derma_other: "OTH",
  dental: "DNT",
}

/** Render a detail value: bullet list when it's clearly a list, else text. */
function DetailValue({ value }: { value: string }) {
  const parts = value.split("، ").map((p) => p.trim()).filter(Boolean)
  const avg = parts.length ? parts.reduce((a, p) => a + p.length, 0) / parts.length : 0
  const bullet = parts.length >= 4 || (parts.length === 3 && avg <= 35)
  if (!bullet) return <p className="text-sm text-foreground leading-relaxed">{value}</p>
  return (
    <ul className="space-y-0.5 text-sm text-foreground">
      {parts.map((p, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-primary mt-0.5 shrink-0">•</span>
          <span>{p}</span>
        </li>
      ))}
    </ul>
  )
}

function H5({ children }: { children: React.ReactNode }) {
  return <h5 className="text-xs font-bold text-muted-foreground pt-2">{children}</h5>
}

export function ServicesGuide({ services }: { services: Svc[] }) {
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)

  const list = useMemo(() => {
    const words = gdNorm(query).split(/\s+/).filter(Boolean)
    if (words.length === 0) return services
    return services.filter((sv) => {
      const hay = gdNorm(`${sv.name} ${sv.summary} ${sv.branch ?? ""}`)
      return words.every((w) => hay.includes(w))
    })
  }, [services, query])

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground">Services Guide</h1>
        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
          دليل خدمات Allure الكامل (22 خدمة). الدليل مافيهوش أسعار — الأسعار كلها في مكتب الأسعار على صفحة
          الفروع. خلي بالك إن التجمع الخامس أسعاره مختلفة في أغلب الخدمات.
        </p>
      </div>

      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 mb-4">
        <Search size={15} className="text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="دور على خدمة… (مثال: فيلر، ليزر، أسنان)"
          className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          dir="rtl"
        />
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">مفيش خدمة مطابقة للبحث.</p>
      ) : (
        <div className="space-y-2">
          {list.map((sv) => (
            <ServiceCard key={sv.id} sv={sv} open={openId === sv.id} onToggle={() => setOpenId(openId === sv.id ? null : sv.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function ServiceCard({ sv, open, onToggle }: { sv: Svc; open: boolean; onToggle: () => void }) {
  const cat = SVC_CAT[sv.id]
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full text-start flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">{sv.name}</span>
            {sv.branch && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[var(--gold-tint)] text-[var(--gold)] font-medium">
                <MapPin size={9} /> {sv.branch}
              </span>
            )}
          </div>
          {!open && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{sv.summary}</p>}
        </div>
        <ChevronDown size={16} className={cn("shrink-0 text-muted-foreground transition-transform mt-0.5", open && "rotate-180")} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-border/60 pt-3">
          <p className="text-sm text-foreground leading-relaxed">{sv.summary}</p>

          {cat && (
            <Link
              href={`/dashboard?cat=${cat}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Tag size={12} /> الأسعار
            </Link>
          )}

          {sv.details.map(([label, value], i) => (
            <div key={i}>
              <H5>{label}</H5>
              <DetailValue value={value} />
            </div>
          ))}

          {sv.products.length > 0 && (
            <>
              <H5>المنتجات / الماركات المتاحة</H5>
              <div className="space-y-1.5">
                {sv.products.map((p, i) => (
                  <div key={i} className="text-sm bg-muted/40 rounded-lg px-3 py-2">
                    <span className="font-semibold text-foreground">{p[0]}</span>
                    {p[1] && <span className="text-muted-foreground"> — {p[1]}</span>}
                    {p[2] && <p className="text-xs text-muted-foreground mt-0.5">{p[2]}</p>}
                  </div>
                ))}
              </div>
            </>
          )}

          {sv.booking.length > 0 && (
            <>
              <H5>قواعد الحجز (زي مكتب الأسعار)</H5>
              <ul className="space-y-1 text-sm text-foreground">
                {sv.booking.map((b, i) => (
                  <li key={i} className="flex gap-2"><span className="text-primary mt-0.5 shrink-0">•</span><span>{b}</span></li>
                ))}
              </ul>
            </>
          )}

          {sv.care.length > 0 && (
            <>
              <H5>قبل وبعد الجلسة (للريسبشن)</H5>
              <ul className="space-y-1 text-sm text-foreground">
                {sv.care.map(([a, b], i) => (
                  <li key={i} className="flex gap-2"><span className="text-primary mt-0.5 shrink-0">•</span><span><b>{a}:</b> {b}</span></li>
                ))}
              </ul>
            </>
          )}

          {sv.say.length > 0 && (
            <>
              <H5>إزاي ترد</H5>
              <div className="space-y-2">
                {sv.say.map(([q, a], i) => (
                  <div key={i} className="text-sm">
                    <p className="text-foreground font-medium">«{q}»</p>
                    <p className="text-muted-foreground">← {a}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="rounded-xl border border-[var(--rose)]/30 bg-[var(--rose-tint)] p-3 text-sm text-foreground">
            <b>حوّل للدكتور فورًا لو:</b> {sv.escalate}
          </div>

          {sv.review.length > 0 && (
            <>
              <H5>راجع نفسك</H5>
              <ol className="list-decimal pe-5 space-y-0.5 text-sm text-foreground marker:text-primary">
                {sv.review.map((q, i) => <li key={i} className="ps-1">{q}</li>)}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  )
}
