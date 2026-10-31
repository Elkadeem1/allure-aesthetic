"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Copy } from "lucide-react"
import { cn } from "cn"
import type { ManualData } from "@/app/(agent)/dashboard/assist-actions"

const SECTIONS = [
  { key: "basics", label: "أنت في ألور" },
  { key: "comm", label: "مهارات التواصل" },
  { key: "structure", label: "هيكل المكالمة" },
  { key: "scenarios", label: "سيناريوهات التعامل" },
  { key: "objections", label: "الاعتراضات" },
  { key: "outbound", label: "المكالمات الصادرة" },
  { key: "escalation", label: "التصعيد وجهات التواصل" },
  { key: "quality", label: "الجودة والمؤشرات" },
  { key: "reference", label: "كروت مرجعية" },
]

/* ---------- row shapes ---------- */
type Boundary = { topic: string; can: string; never: string }
type Voice = { state: string; tone: string; example: string }
type Empathy = { situation: string; phrases: string[] }
type Replace = { instead: string; say: string }
type CallStep = { n: string; name: string; goal: string; phrase: string }
type Scenario = { id: string; title: string; goal: string; danger?: string; steps?: string[]; script?: string; tip?: string; forbidden?: string[]; escalation?: string }
type Objection = { objection: string; reason: string; response: string }
type Outbound = { title: string; script: string }
type Escalation = { situation: string; who: string; when: string }
type Contact = { role: string; name: string; phone: string }
type QA = { item: string; weight: string; req: string }
type KPI = { k: string; v: string; note: string }
type StatusRow = { s: string; m: string }
type GlossRow = { t: string; m: string }

/* ---------- primitives ---------- */

const TONE: Record<string, string> = {
  tip: "bg-[var(--sage-tint)] border-[var(--sage)]/40 text-foreground",
  warn: "bg-[var(--gold-tint)] border-[var(--gold)]/40 text-foreground",
  danger: "bg-[var(--status-breach-bg)] border-[var(--status-breach)]/40 text-foreground",
  script: "bg-[var(--rose-tint)] border-[var(--rose)]/30 text-foreground",
}

function Box({ tone, title, children }: { tone: keyof typeof TONE; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border p-3 text-sm space-y-1.5", TONE[tone])}>
      <div className="font-bold text-xs flex items-center gap-2">{title}</div>
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 text-sm text-foreground">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-primary mt-0.5 shrink-0">•</span>
          <span className="leading-relaxed">{it}</span>
        </li>
      ))}
    </ul>
  )
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-foreground pt-1">{children}</h3>
}

function DataTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted/40 text-muted-foreground">
            {head.map((h, i) => (
              <th key={i} className="text-start px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/60 align-top">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 text-foreground">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Copy only the agent's own lines (those starting with "أنت"), stripped. */
function scriptCopyText(text: string): string {
  const lines = text.split("\n")
  const mine = lines.filter((l) => /^أنت/.test(l)).map((l) => l.replace(/^أنت[^:]*:\s*/, ""))
  return (mine.length ? mine : lines).join("\n").trim()
}

function ScriptBox({ text }: { text: string }) {
  const copy = () => {
    const t = scriptCopyText(text)
    const done = () => toast.success("اتنسخ")
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(t).then(done).catch(done)
    else done()
  }
  return (
    <div className={cn("rounded-xl border p-3 space-y-2", TONE.script)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold">🗨️ السكريبت</span>
        <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 h-7 rounded-lg bg-card border border-border text-foreground hover:bg-muted transition-colors active:scale-[0.98]">
          <Copy size={12} /> نسخ
        </button>
      </div>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  )
}

function Title({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{sub}</p>}
    </div>
  )
}

/* ---------- drawer ---------- */

export function SoftSkillsDrawer({ manual }: { manual: ManualData }) {
  const [key, setKey] = useState("basics")
  const arr = useMemo(() => <T,>(k: string): T[] => (Array.isArray(manual[k]) ? (manual[k] as T[]) : []), [manual])

  return (
    <div className="space-y-4">
      {/* section chips */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setKey(s.key)}
            className={cn(
              "shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
              s.key === key ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-foreground hover:bg-muted"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">{renderSection(key, arr)}</div>
    </div>
  )
}

function renderSection(key: string, arr: <T>(k: string) => T[]): React.ReactNode {
  switch (key) {
    case "basics":
      return (
        <>
          <Title title="أنت في ألور — دورك وحدودك" sub="العميل اللي بيتصل غالبًا قلقان أو محرج أو متضايق. مكالمتك مش «حجز ميعاد» بس، هي إحساس بالأمان." />
          <Box tone="tip" title="💡 دورك في جملة واحدة">
            أنت مش دكتور، ومش بياع بيلح على العميل. أنت مرشد العميل (Guide): بتوصله للدكتور الصح، في الفرع الصح، في الوقت الصح، وهو مطمن.
          </Box>
          <H3>القواعد الذهبية الخمسة</H3>
          <ol className="list-decimal pe-5 space-y-1 text-sm text-foreground marker:text-primary marker:font-bold">
            {arr<string>("golden_rules").map((r, i) => <li key={i} className="ps-1 leading-relaxed">{r}</li>)}
          </ol>
          <H3>خط الحدود الطبية</H3>
          <DataTable
            head={["الموضوع", "اللي تقدر تقوله", "اللي ما تقولوش أبدًا"]}
            rows={arr<Boundary>("medical_boundary").map((r) => [<b key="t">{r.topic}</b>, r.can, r.never])}
          />
          <Box tone="tip" title="💡 نصيحة">
            لو مش متأكد إذا كان سؤال العميل طبي ولا لأ، اعتبره طبي، وقول: «هتأكد لحضرتك من المعلومة وهأرجع أتابع في أقرب وقت».
          </Box>
          <H3>سرية بيانات العميل</H3>
          <Bullets items={arr<string>("privacy_rules")} />
          <ScriptBox text={"حد من العيلة بيسأل عن ميعاد أو حالة:\nالعميل: أنا جوزها وعايز أعرف ميعادها إمتى؟\nأنت: أهلاً بحضرتك. حفاظًا على خصوصية عملائنا، مقدرش أفصح عن أي بيانات إلا لصاحب الحجز نفسه. لو في إمكانية هي تتواصل معانا مباشرة."} />
        </>
      )

    case "comm":
      return (
        <>
          <Title title="مهارات التواصل على التليفون" sub="على التليفون مفيش وش ولا لغة جسد. كل الانطباع بيتبني على صوتك + كلماتك + طريقة استماعك." />
          <H3>صوتك وأول انطباع</H3>
          <DataTable head={["حالة العميل", "نبرتك", "مثال"]} rows={arr<Voice>("voice_table").map((r) => [<b key="s">{r.state}</b>, r.tone, r.example])} />
          <H3>الاستماع الفعّال — ٣ خطوات</H3>
          <Bullets items={["اسمع من غير مقاطعة لحد ما العميل يخلص جملته.", "أعد الصياغة (Paraphrase): «يعني حضرتك...».", "اتأكد (Confirm): «مظبوط كده؟» وما تكمّلش غير لما العميل يقول أيوه."]} />
          <ScriptBox text={"العميل: أنا عايزة أعمل ليزر بس لسه راجعة من الساحل وجلدي اتعرض للشمس كتير.\nأنت: يعني حضرتك لسه راجعة من الساحل وجلدك اتعرض للشمس، وعايزة تبدأي جلسات ليزر. مظبوط كده؟\nأنت (بعد التأكيد): تمام، وشكرًا إن حضرتك قلتيلي، لأن التعرض للشمس من النقط المهمة اللي الدكتور بيقيّمها قبل الليزر. هأسأل القسم الطبي وأرجع لحضرتك في أقرب وقت."} />
          <H3>التعاطف — المعادلة</H3>
          <Box tone="tip" title="المعادلة">اعتراف بالإحساس + سبب بسيط + التزام بخطوة</Box>
          <DataTable
            head={["الموقف", "عبارات تقدر تستخدمها"]}
            rows={arr<Empathy>("empathy_table").map((r) => [<b key="s">{r.situation}</b>, <span key="p">{r.phrases.map((p, i) => <div key={i}>{p}</div>)}</span>])}
          />
          <Box tone="warn" title="⚠️ عبارات ممنوعة">
            «متقلقش» و«ده عادي» و«معلش» لوحدها بتقلل من إحساس العميل. و«دي سياسة الشركة» / «مش مسؤوليتي» ممنوعة — قول «الإجراء المعتمد» أو «هوصلك للمسؤول».
          </Box>
          <H3>بدل ما تقول... قول</H3>
          <DataTable head={["بدل ما تقول", "قول"]} rows={arr<Replace>("replace_table").map((r) => [r.instead, r.say])} />
          <ScriptBox text={"قبل الانتظار — أنت: هأستأذن حضرتك لحظات معايا ع الانتظار وارجعلك على طول.\nلو عدّى ٣٠ ثانية — أنت: أستاذ/ة [الاسم]، لسه بتأكد من المعلومة، إسمحلي لحظات دقيقة كمان؟\nبعد الرجوع — أنت: أستاذ/ة [الاسم] حضرتك معايا؟ شكرًا لانتظار حضرتك.\n\nتحويل مباشر (Warm Transfer) — أنت: الموضوع ده محتاج [الدكتور / مدير الفرع]. هحول حضرتك ليه دلوقتي وهبلّغه بالتفاصيل علشان حضرتك ما تعيدش الكلام.\nللمستلم قبل التحويل: «الاسم — الرقم — الفرع — المشكلة في جملة — المطلوب.»"} />
          <H3>التحكم في الانفعال</H3>
          <Bullets items={["وقفة ٣ ثواني قبل ما ترد على أي حاجة مستفزة.", "نفس عميق من غير ما العميل يسمعه.", "رد بجملة واحدة هادية من جدول التعاطف.", "ذكر نفسك: الغضب على الموقف مش عليك."]} />
        </>
      )

    case "structure":
      return (
        <>
          <Title title="هيكل المكالمة — ٧ خطوات" sub="أي مكالمة، مهما كان موضوعها، بتمشي الهيكل ده يبقى في دماغك تفضل متحكم في المكالمة حتى لو العميل مش متحكم في نفسه." />
          <DataTable head={["الخطوة", "هدفها", "جملة مفتاحية"]} rows={arr<CallStep>("call_steps").map((r) => [<b key="n">{r.n}. {r.name}</b>, r.goal, r.phrase])} />
          <H3>بيانات الحجز الأساسية في Dentolize</H3>
          <Bullets items={["الاسم ثنائي.", "رقم الموبايل: خده كوبي من Issabel أو WhatsApp، ولو رقم آخر اقراه بصوت واضح وأكده.", "الفرع، والخدمة.", "اليوم والساعة: اعرض اختيارين بدل السؤال المفتوح «إمتى؟».", "عميل جديد ولا قديم؟", "ملاحظة مهمة للدكتور: سؤال عام واحد بس — «في أي حاجة صحية حابب تبلّغها للدكتور قبل الميعاد؟». ما تسجلش تشخيصات ولا تفاصيل طبية زيادة."]} />
          <ScriptBox text={"أنت: عندنا يوم الثلاثاء الساعة ٥ العصر أو الأربعاء الساعة ١٢ الظهر. أنهي أنسب لحضرتك؟\nأنت (بعد الاختيار): بكرر مع حضرتك: أستاذة سارة، يوم الثلاثاء ٢٤، الساعة ٥ العصر، فرع التجمع الخامس، استشارة. والرقم ٠١٠-XXXX-XXXX. مظبوط؟"} />
          <H3>الإغلاق والتوثيق</H3>
          <Bullets items={["سيب العميل هو اللي يقفل الأول.", "التوثيق (After Call Work): سجل المكالمة فورًا — السبب، اللي اتفقتوا عليه، أي متابعة مطلوبة، والـ Tag الصح.", "أي خطوة متابعة لازم يبقى لها مسؤول وميعاد."]} />
        </>
      )

    case "scenarios":
      return (
        <>
          <Title title="سيناريوهات التعامل" sub="كل موقف مبني على نفس المنطق: افهم ← اعترف ← رد بأمان ← خطوة واضحة." />
          {arr<Scenario>("scenarios").map((sc) => (
            <div key={sc.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-foreground flex-1">{sc.title}</h4>
                <span className="text-[10px] text-muted-foreground tabular">{sc.id}</span>
              </div>
              <p className="text-xs text-muted-foreground"><b className="text-foreground">هدفك:</b> {sc.goal}</p>
              {sc.danger && <Box tone="danger" title="🚨 طوارئ فورية">{sc.danger.split("\n").map((l, i) => <div key={i}>{l}</div>)}</Box>}
              {sc.steps && (
                <div>
                  <b className="text-sm text-foreground">خطواتك</b>
                  <ol className="list-decimal pe-5 space-y-1 text-sm text-foreground marker:text-primary mt-1">
                    {sc.steps.map((s, i) => <li key={i} className="ps-1">{s}</li>)}
                  </ol>
                </div>
              )}
              {sc.script && <ScriptBox text={sc.script} />}
              {sc.tip && <Box tone="tip" title="💡 نصيحة">{sc.tip}</Box>}
              {sc.forbidden && <Box tone="warn" title="⚠️ ممنوع"><Bullets items={sc.forbidden} /></Box>}
              {sc.escalation && <Box tone="danger" title="🚨 التصعيد">{sc.escalation}</Box>}
            </div>
          ))}
        </>
      )

    case "objections":
      return (
        <>
          <Title title="الرد على الاعتراضات" sub="الاعتراض مش رفض. غالبًا هو سؤال متخفّي أو خوف محتاج طمأنة: اعترف ← افهم السبب ← رد بصدق ← اقترح خطوة." />
          <DataTable head={["الاعتراض", "اللي غالبًا وراه", "رد نموذجي"]} rows={arr<Objection>("objections").map((r) => [<b key="o">{r.objection}</b>, r.reason, r.response])} />
        </>
      )

    case "outbound":
      return (
        <>
          <Title title="المكالمات الصادرة (Outbound)" sub="لما إنت اللي بتتصل، العميل مش مستني مكالمتك. أول ١٠ ثواني هم اللي بيحددوا إذا كان هيسمعك ولا لأ." />
          <Box tone="warn" title="قواعد ثابتة"><Bullets items={arr<string>("outbound_rules")} /></Box>
          {arr<Outbound>("outbound").map((o, i) => (
            <div key={i} className="space-y-1.5">
              <H3>{o.title}</H3>
              <ScriptBox text={o.script} />
            </div>
          ))}
        </>
      )

    case "escalation":
      return (
        <>
          <Title title="مصفوفة التصعيد" sub="التصعيد مش ضعف، ده جزء من شغلك. اللي بيفشل هو اللي بيستنى أو بيحاول يحلها لوحده في حاجة طبية." />
          <DataTable head={["الموقف", "تصعد لمين", "إمتى وإزاي"]} rows={arr<Escalation>("escalation_matrix").map((r) => [<b key="s">{r.situation}</b>, r.who, r.when])} />
          <H3>بطاقة التسليم (Handover) — ٥ نقط بس</H3>
          <Bullets items={arr<string>("handover_card")} />
          <H3>جهات التواصل الداخلية</H3>
          <DataTable head={["الجهة", "الاسم", "الرقم"]} rows={arr<Contact>("contacts").map((r) => [r.role, r.name, <span key="p" dir="ltr" className="tabular">{r.phone}</span>])} />
        </>
      )

    case "quality":
      return (
        <>
          <Title title="الجودة والمؤشرات" sub="مكالماتك بتتقيم على معايير معروفة ومعلنة. عارف إنت بتتقيّم على إيه = عارف تعمل إيه." />
          <H3>كارت تقييم المكالمة (QA Scorecard)</H3>
          <DataTable head={["البند", "الوزن", "المطلوب"]} rows={arr<QA>("qa_scorecard").map((r) => [<b key="i">{r.item}</b>, r.weight, r.req])} />
          <Box tone="danger" title="🚨 أخطاء قاتلة — المكالمة بتاخد صفر"><Bullets items={arr<string>("critical_errors")} /></Box>
          <H3>المؤشرات (KPIs)</H3>
          <DataTable head={["المؤشر", "يعني إيه", "ملحوظة"]} rows={arr<KPI>("kpis").map((r) => [<b key="k">{r.k}</b>, r.v, r.note])} />
          <H3>اسأل نفسك بعد كل مكالمة</H3>
          <Bullets items={["هل سمعته للآخر وفهمت المطلوب فعلاً؟", "هل قلت حاجة طبية مش دوري؟", "هل اتحقق من هويته قبل ما أفصح عن بيانات؟", "هل خرج العميل وهو عارف بالظبط الخطوة الجاية؟", "هل وثّقت كل حاجة؟"]} />
        </>
      )

    case "reference":
      return (
        <>
          <Title title="كروت مرجعية للسيستم" />
          <H3>حالات الحجز في السيستم</H3>
          <DataTable head={["الحالة", "المعنى"]} rows={arr<StatusRow>("status_meanings").map((r) => [<b key="s" dir="ltr">{r.s}</b>, r.m])} />
          <H3>قراءة الأرقام والمواعيد</H3>
          <Bullets items={["التليفون: ٣-٤-٤. مثال: «٠١٠ — ١٢٣٤ — ٥٦٧٨».", "الميعاد: اليوم + التاريخ + الساعة + الفرع: «الثلاثاء ٢٤، الساعة ٥ العصر، فرع التجمع الخامس».", "اطلب دائمًا من العميل يكرر رقمه أو ميعاده."]} />
          <H3>قاموس المصطلحات</H3>
          <DataTable head={["المصطلح", "المعنى"]} rows={arr<GlossRow>("glossary").map((r) => [<b key="t" dir="ltr">{r.t}</b>, r.m])} />
          <Box tone="danger" title="لو نسيت كل حاجة، افتكر التلاتة دول">
            <Bullets items={["الأمان قبل الحجز. أي شك طبي = الدكتور.", "ما تعدش بنتيجة أو خصم أو حاجة مش في إيدك.", "وثّق كل حاجة، وكل مكالمة تخلص بخطوة واضحة."]} />
          </Box>
        </>
      )

    default:
      return null
  }
}
