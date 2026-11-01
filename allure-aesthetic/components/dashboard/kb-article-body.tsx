import type { ReactNode } from "react"

// Shapes stored in kb_articles.body (see scripts/extract-mvp.mjs):
//   service:*  -> the MVP SERVICES22 object
//   def:*      -> the MVP DEFS object
type ServiceBody = {
  branch?: string | null
  summary?: string
  details?: [string, string][]
  products?: [string, string, string][]
  booking?: string[]
  care?: [string, string][]
  say?: [string, string][]
  escalate?: string
  review?: string[]
}

type DefBody = {
  priceNote?: string
  explain?: string
  indications?: string[]
  before?: string[]
  after?: string[]
  contra?: string[]
  neverSay?: string[]
}

/* ---------------- shared bits ---------------- */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-muted-foreground mb-1.5">{title}</h4>
      {children}
    </div>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 text-sm text-foreground">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-primary mt-0.5 shrink-0">•</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

// 📍 branch / price note — small highlighted box.
function NoteBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--gold-tint)] text-[var(--gold)] text-sm font-medium px-3 py-2">
      {children}
    </div>
  )
}

// 🗨️ "إزاي تشرحها للعميل" script box.
function ScriptBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2.5">
      <div className="text-xs font-bold text-muted-foreground mb-1">🗨️ إزاي تشرحها للعميل</div>
      <div className="text-sm text-foreground leading-relaxed">{children}</div>
    </div>
  )
}

function WarnBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--rose)]/30 bg-[var(--rose-tint)] px-3 py-2.5">
      <div className="text-xs font-bold text-[var(--rose)] mb-1">{title}</div>
      <div className="text-sm text-foreground leading-relaxed">{children}</div>
    </div>
  )
}

// Mirrors formatDetailValue() in the MVP HTML: split a leading "intro:" and
// bullet-list the comma-separated tail when it clearly reads as a list.
function DetailValue({ value }: { value: string }) {
  let intro = ""
  let body = value
  const colon = value.indexOf(":")
  if (colon > -1 && colon <= 18) {
    intro = value.slice(0, colon + 1).trim()
    body = value.slice(colon + 1).trim()
  }
  const parts = body.split("، ").map((p) => p.trim()).filter(Boolean)
  const avg = parts.length ? parts.reduce((a, p) => a + p.length, 0) / parts.length : 0
  const bullet = parts.length >= 4 || (parts.length === 3 && avg <= 35)
  if (!bullet) return <p className="text-sm text-foreground leading-relaxed">{value}</p>
  return (
    <>
      {intro && <p className="text-sm text-foreground mb-1">{intro}</p>}
      <Bullets items={parts} />
    </>
  )
}

const EMPTY = "لا توجد معلومات إضافية عن الخدمة دي حاليًا."

/* ---------------- article shapes ---------------- */

function ServiceArticle({ sv }: { sv: ServiceBody }) {
  return (
    <div className="space-y-4">
      {sv.branch && <NoteBox>📍 {sv.branch}</NoteBox>}
      {sv.summary && <ScriptBox>{sv.summary}</ScriptBox>}

      {sv.details?.map(([label, value], i) => (
        <Section key={i} title={label}>
          <DetailValue value={value} />
        </Section>
      ))}

      {sv.products && sv.products.length > 0 && (
        <Section title="المنتجات/الماركات المتاحة">
          <div className="space-y-1.5">
            {sv.products.map((p, i) => (
              <div key={i} className="text-sm bg-muted/50 rounded-lg px-3 py-2">
                <span className="font-semibold text-foreground">{p[0]}</span>
                {p[1] && <span className="text-[var(--rose)]"> — {p[1]}</span>}
                {p[2] && <p className="text-xs text-muted-foreground mt-0.5">{p[2]}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {sv.booking && sv.booking.length > 0 && (
        <Section title="قواعد الحجز">
          <Bullets items={sv.booking} />
        </Section>
      )}

      {sv.care && sv.care.length > 0 && (
        <Section title="قبل وبعد الجلسة">
          <ul className="space-y-1 text-sm text-foreground">
            {sv.care.map(([label, value], i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span><b>{label}:</b> {value}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {sv.say && sv.say.length > 0 && (
        <Section title="قول للعميل">
          <div className="space-y-2">
            {sv.say.map(([q, a], i) => (
              <div key={i} className="text-sm">
                <p className="text-foreground font-bold">«{q}»</p>
                <p className="text-muted-foreground">← {a}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {sv.escalate && <WarnBox title="🚨 حوّل للدكتور فورًا لو">{sv.escalate}</WarnBox>}

      {sv.review && sv.review.length > 0 && (
        <Section title="راجع نفسك">
          <ol className="list-decimal pe-5 space-y-0.5 text-sm text-foreground marker:text-primary">
            {sv.review.map((q, i) => <li key={i} className="ps-1">{q}</li>)}
          </ol>
        </Section>
      )}
    </div>
  )
}

function DefArticle({ def }: { def: DefBody }) {
  return (
    <div className="space-y-4">
      {def.priceNote && <NoteBox>{def.priceNote}</NoteBox>}
      {def.explain && <ScriptBox>{def.explain}</ScriptBox>}

      {def.indications && def.indications.length > 0 && (
        <Section title="دواعي الاستخدام"><Bullets items={def.indications} /></Section>
      )}
      {def.before && def.before.length > 0 && (
        <Section title="قبل الجلسة"><Bullets items={def.before} /></Section>
      )}
      {def.after && def.after.length > 0 && (
        <Section title="بعد الجلسة"><Bullets items={def.after} /></Section>
      )}
      {def.contra && def.contra.length > 0 && (
        <Section title="موانع الاستخدام (بلّغ الدكتور بيها)"><Bullets items={def.contra} /></Section>
      )}

      {def.neverSay && def.neverSay.length > 0 && (
        <WarnBox title="⚠️ ممنوع تقوله للعميل"><Bullets items={def.neverSay} /></WarnBox>
      )}
    </div>
  )
}

/* ---------------- entry point ---------------- */

export function KbArticleBody({ slug, body }: { slug: string; body: unknown }) {
  if (body && typeof body === "object") {
    if (slug.startsWith("service:")) return <ServiceArticle sv={body as ServiceBody} />
    if (slug.startsWith("def:")) return <DefArticle def={body as DefBody} />
  }
  return <p className="text-sm text-muted-foreground text-center py-8">{EMPTY}</p>
}
