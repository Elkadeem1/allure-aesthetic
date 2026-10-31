"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Copy, RefreshCw } from "lucide-react"
import { cn } from "cn"
import { formatNumber } from "@/lib/format"
import { cairoToday } from "@/lib/time"
import { DAY_LABELS, dayInfo, segLabel, weekDates, weekdaySat0 } from "@/components/dashboard/schedule-utils"
import type { BranchData } from "@/components/dashboard/types"
import type { FlowStep, Situation } from "@/app/(agent)/dashboard/assist-actions"

const money = (n: number) => `${formatNumber(n)} ج`

function greeting(): string {
  let h: number
  try {
    h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", hour12: false }).format(new Date()))
  } catch {
    h = new Date().getHours()
  }
  return h % 24 < 12 ? "صباح الخير" : "مساء الخير"
}

/* ---------- WhatsApp-ish text rendering (*bold*, [placeholder], \n) ---------- */

function renderLine(line: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(\*[^*\n]+\*|\[[^\]\n]+\])/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(<span key={i++}>{line.slice(last, m.index)}</span>)
    const tok = m[0]
    if (tok.startsWith("*")) out.push(<b key={i++} className="font-bold text-foreground">{tok.slice(1, -1)}</b>)
    else
      out.push(
        <span key={i++} className="inline-block bg-[var(--gold-tint)] text-[var(--gold)] rounded px-1 text-[11px] font-medium">
          {tok}
        </span>
      )
    last = m.index + tok.length
  }
  if (last < line.length) out.push(<span key={i++}>{line.slice(last)}</span>)
  return out
}

function ChatText({ text }: { text: string }) {
  return (
    <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
      {text.split("\n").map((ln, i) => (
        <div key={i}>{ln ? renderLine(ln) : " "}</div>
      ))}
    </div>
  )
}

/* ---------- card ---------- */

function ChatCard({ title, text, dyn, extra }: { title: string; text: string; dyn?: boolean; extra?: React.ReactNode }) {
  const copy = () => {
    const done = () => toast.success("اتنسخ")
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(done)
    else done()
  }
  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-foreground flex-1">{title}</span>
        {dyn && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--sage-tint)] text-[var(--sage)]">
            <RefreshCw size={9} /> من البيانات الحية
          </span>
        )}
      </div>
      {extra}
      <ChatText text={text} />
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-lg bg-card border border-border text-foreground hover:bg-muted transition-colors active:scale-[0.98]"
      >
        <Copy size={13} /> نسخ
      </button>
    </div>
  )
}

function Section({ title }: { title: string }) {
  return <h3 className="text-xs font-semibold text-muted-foreground pt-2">{title}</h3>
}

/* ---------- drawer ---------- */

export function ChatDrawer({
  branches,
  flow,
  situations,
}: {
  branches: BranchData[]
  flow: FlowStep[]
  situations: Situation[]
}) {
  const initialBranch = (() => {
    try {
      const last = localStorage.getItem("allure.lastBranchId")
      if (last && branches.some((b) => b.id === last)) return last
    } catch {
      /* ignore */
    }
    return branches[0]?.id ?? ""
  })()

  const [agent, setAgent] = useState(() => {
    try {
      return localStorage.getItem("ah_agent_name") ?? ""
    } catch {
      return ""
    }
  })
  const [branchId, setBranchId] = useState(initialBranch)
  const [request, setRequest] = useState("")
  const [service, setService] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [doctorIdx, setDoctorIdx] = useState(0)

  const branch = branches.find((b) => b.id === branchId)
  const todayStr = cairoToday()

  const onAgent = (v: string) => {
    setAgent(v)
    try {
      localStorage.setItem("ah_agent_name", v.trim())
    } catch {
      /* ignore */
    }
  }

  const fill = useMemo(() => {
    const map: Record<string, string> = {
      "تحية": greeting(),
      "اسمك": agent.trim() || "[اسمك]",
      "الفرع": branch?.nameAr ?? "[الفرع]",
      "طلب": request.trim() || "[طلب العميل]",
      "خدمة": service.trim() || "[الخدمة]",
      "تاريخ": date.trim() || "[التاريخ]",
      "وقت": time.trim() || "[الوقت]",
      "عنوان": branch?.address ?? "[العنوان]",
      "دفع": branch?.paymentMethods.join(" / ") || "[طرق الدفع]",
    }
    return (tpl: string) => tpl.replace(/\{([^}]+)\}/g, (m, k) => (map[k] !== undefined ? map[k] : m))
  }, [agent, branch, request, service, date, time])

  // dynamic (live-data) cards
  const dynamic = useMemo(() => {
    if (!branch) return [] as { title: string; text: string; extra?: React.ReactNode }[]
    const label = branch.nameAr
    const cards: { title: string; text: string; extra?: React.ReactNode }[] = []

    cards.push({
      title: "العنوان وطرق الدفع",
      text: `📍 فرع ${label}\n${branch.address ?? ""}\n💳 طرق الدفع: ${branch.paymentMethods.join(" / ")}`,
    })

    if (branch.consultations.length > 0) {
      const lines = branch.consultations.map((c) => `• ${c.label}: *${c.priceText ?? (c.price != null ? money(c.price) : "—")}*`)
      cards.push({ title: "أسعار الكشف", text: `💬 أسعار الكشف في فرع ${label}:\n${lines.join("\n")}` })
    }

    const women = (branch.laserTable?.women ?? []).filter((r) => r.single != null)
    if (women.length > 0) {
      const lines = women.map((r) => `• ${r.label}: *${money(r.single as number)}*` + (r.package3 != null ? ` — باقة ٣ جلسات ${money(r.package3)}` : ""))
      cards.push({ title: "أسعار ليزر السيدات", text: `✨ أسعار ليزر إزالة الشعر للسيدات — فرع ${label}\n${lines.join("\n")}\n\nالأسعار للجلسة، والدكتور بيحدد المناسب بعد الكشف.` })
    }
    const men = (branch.laserTable?.men ?? []).filter((r) => r.single != null)
    if (men.length > 0) {
      const lines = men.map((r) => `• ${r.label}: *${money(r.single as number)}*`)
      cards.push({ title: "أسعار ليزر الرجالة", text: `✨ أسعار ليزر إزالة الشعر للرجال — فرع ${label}\n${lines.join("\n")}\n\nالأسعار للجلسة، والدكتور بيحدد المناسب بعد الكشف.` })
    }

    if (branch.doctors.length > 0) {
      const di = Math.min(doctorIdx, branch.doctors.length - 1)
      const d = branch.doctors[di]
      const lines = weekDates(todayStr)
        .map((dt) => {
          const inf = dayInfo(d, dt, [])
          if (inf.off || inf.segs.length === 0) return null
          return `• ${DAY_LABELS[weekdaySat0(dt)]}: ${inf.segs.map(segLabel).join(" / ")}`
        })
        .filter(Boolean) as string[]
      const extra = (
        <div className="space-y-1.5">
          <select
            value={di}
            onChange={(e) => setDoctorIdx(Number(e.target.value))}
            className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-card text-foreground outline-none focus-visible:border-ring"
          >
            {branch.doctors.map((x, i) => (
              <option key={x.id} value={i}>{x.displayName}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">⚠️ المواعيد دي من الجدول (الأسبوع الحالي) — راجع الـ Updates قبل ما تأكد.</p>
        </div>
      )
      cards.push({
        title: "مواعيد دكتورة",
        text: `👩‍⚕️ مواعيد ${d.displayName} في فرع ${label}:\n${lines.length ? lines.join("\n") : "مفيش مواعيد متسجلة حاليًا."}`,
        extra,
      })
    }

    if (branch.services.length > 0) {
      cards.push({ title: "الخدمات المتاحة في الفرع", text: `🩺 الخدمات المتاحة في فرع ${label}:\n${branch.services.map((s) => `• ${s.nameAr}`).join("\n")}` })
    }
    return cards
  }, [branch, doctorIdx, todayStr])

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder: string) => (
    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card text-foreground outline-none focus-visible:border-ring placeholder:text-muted-foreground/70"
      />
    </label>
  )

  return (
    <div className="space-y-3">
      {/* inputs */}
      <div className="grid grid-cols-2 gap-2 bg-muted/30 border border-border rounded-xl p-3">
        {field("اسمك (بيتحفظ)", agent, onAgent, "مثلاً: منة")}
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
          الفرع
          <select
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value)
              setDoctorIdx(0)
            }}
            className="text-sm border border-border rounded-lg px-2 py-1.5 bg-card text-foreground outline-none focus-visible:border-ring"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.nameAr}</option>
            ))}
          </select>
        </label>
        {field("طلب العميل", request, setRequest, "مثلاً: ليزر إزالة شعر")}
        {field("الخدمة", service, setService, "الخدمة المحجوزة")}
        {field("التاريخ", date, setDate, "مثلاً: الثلاثاء ٦ أكتوبر")}
        {field("الوقت", time, setTime, "مثلاً: ٤ م")}
      </div>

      <Section title="هيكل الشات (٦ مراحل)" />
      {flow.map((s, i) =>
        s.t ? (
          <ChatCard key={i} title={s.title} text={fill(s.t)} />
        ) : (
          <div key={i} className="bg-muted/40 border border-border rounded-xl p-3">
            <span className="text-xs font-bold text-foreground">{s.title}</span>
            {s.note && <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.note}</p>}
          </div>
        )
      )}

      <Section title={`ردود من البيانات الحية — فرع ${branch?.nameAr ?? ""}`} />
      {dynamic.map((c, i) => (
        <ChatCard key={i} title={c.title} text={c.text} dyn extra={c.extra} />
      ))}

      <Section title="ردود إضافية حسب الموقف" />
      {situations.map((s, i) => (
        <ChatCard key={i} title={s.title} text={fill(s.t)} />
      ))}
    </div>
  )
}
