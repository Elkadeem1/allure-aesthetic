"use client"

import { useMemo, useState } from "react"
import { Search, AlertTriangle, ArrowLeft } from "lucide-react"
import { cn } from "cn"
import { gdNorm } from "@/lib/arabic"
import type { GuideRow } from "@/app/(agent)/dashboard/assist-actions"

const GD_CATS = ["الكل", "شعر", "بشرة", "شد وحجم", "جسم"]

export function RecommendDrawer({ guide }: { guide: GuideRow[] }) {
  const [text, setText] = useState("")
  const [cat, setCat] = useState("الكل")

  const rows = useMemo(() => {
    const words = gdNorm(text).split(/\s+/).filter(Boolean)
    return guide.filter(
      (r) => (cat === "الكل" || r[0] === cat) && words.every((w) => gdNorm(r.join(" ")).includes(w))
    )
  }, [guide, text, cat])

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب كلام العميل: إزالة شعر، زوائد، نضارة…"
          autoComplete="off"
          className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          dir="rtl"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {GD_CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
              c === cat ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-foreground hover:bg-muted"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            مفيش خدمة مطابقة. اسأل العميل أكتر، أو حوله لكشف جلدية.
          </p>
        ) : (
          rows.map((r, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-foreground flex-1">{r[1]}</span>
                <ArrowLeft size={14} className="text-muted-foreground shrink-0" />
                <span className="font-bold text-[var(--sage)] text-start flex-1">{r[2]}</span>
              </div>
              {r[3] && <p className="mt-1.5 text-xs text-muted-foreground">{r[3]}</p>}
            </div>
          ))
        )}
      </div>

      <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-[var(--gold-tint)]/60 border border-[var(--gold)]/30 rounded-lg px-3 py-2">
        <AlertTriangle size={13} className="shrink-0 mt-0.5 text-[var(--gold)]" />
        <span>
          الايجنت مش بيقرر إن العميل مناسب للخدمة. أي شك طبي أو حمل أو أدوية (رواكيوتان، هربس) ← يسجل
          ويحول للدكتور. وأكد الفرع قبل ما ترشح خدمة.
        </span>
      </div>
    </div>
  )
}
