"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, ChevronDown, MapPin, Tag } from "lucide-react"
import { cn } from "cn"
import { gdNorm } from "@/lib/arabic"
import { KbArticleBody } from "@/components/dashboard/kb-article-body"

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
        <div className="px-4 pb-4 space-y-4 border-t border-border/60 pt-3">
          {cat && (
            <Link
              href={`/dashboard?cat=${cat}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Tag size={12} /> الأسعار
            </Link>
          )}

          <KbArticleBody slug={`service:${sv.id}`} body={sv} />
        </div>
      )}
    </div>
  )
}
