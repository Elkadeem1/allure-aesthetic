"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Building2,
  Sparkles,
  User,
  Scan,
  Stethoscope,
  CalendarDays,
  Check,
  AlertTriangle,
  Info,
  Copy,
  Send,
  Loader2,
} from "lucide-react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"
import { formatEgp, formatNumber } from "@/lib/format"
import {
  DAY_LABELS,
  areasFor,
  availableDates,
  companionMissing,
  dayDiff,
  decide,
  doctorNotes,
  doctorRuleReasons,
  laserAreaPricing,
  laserMinutes,
  sessionMinutes,
  startSlots,
  tLabel,
  toggleArea,
  weekdaySat0,
  type Decision,
  type DoctorContext,
  type Service,
} from "@/lib/engine"
import type { BookingData, WizardBranch } from "@/lib/booking/data"
import { buildWhatsAppMessage, isEgyptMobile } from "@/lib/booking/message"
import { sendTicket } from "@/app/(agent)/dashboard/book/actions"
import type { ClientGender } from "@/lib/types/database.types"

const HORIZON_DAYS = 14

function whenLabel(date: string, today: string): string {
  const diff = dayDiff(date, today)
  if (diff === 0) return "النهاردة"
  if (diff === 1) return "بكرة"
  const [y, m, d] = date.split("-")
  return `${DAY_LABELS[weekdaySat0(date)]} ${d}/${m}/${y}`
}

function dateChipLabel(date: string): string {
  const [, m, d] = date.split("-")
  return `${DAY_LABELS[weekdaySat0(date)]} ${d}/${m}`
}

/* ---------- small building blocks ---------------------------------- */

function StepCard({
  n,
  icon,
  title,
  children,
}: {
  n: number
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center justify-center size-6 rounded-full bg-accent text-primary text-xs font-bold tabular">
          {formatNumber(n)}
        </span>
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card border-border text-foreground hover:bg-muted",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      {children}
    </button>
  )
}

type LaserPricing = ReturnType<typeof laserAreaPricing>

/* ---------- wizard -------------------------------------------------- */

export function BookingWizard({
  data,
  initialBranchId,
  layout = "page",
}: {
  data: BookingData
  initialBranchId?: string
  layout?: "page" | "drawer"
}) {
  const router = useRouter()
  const drawer = layout === "drawer"
  const { laserConfig: cfg, todayStr } = data

  const firstBranch = useMemo(
    () => data.branches.find((b) => b.id === initialBranchId) ?? data.branches[0],
    [data.branches, initialBranchId]
  )

  const [branchId, setBranchId] = useState<string | null>(firstBranch?.id ?? null)
  const [serviceCode, setServiceCode] = useState<string | null>(null)
  const [gender, setGender] = useState<ClientGender | null>(null)
  const [areas, setAreas] = useState<string[]>([])
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [startMin, setStartMin] = useState<number | null>(null)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [note, setNote] = useState("")
  const [booked, setBooked] = useState(false)
  const [sending, setSending] = useState(false)

  const branch: WizardBranch | undefined = useMemo(
    () => data.branches.find((b) => b.id === branchId),
    [data.branches, branchId]
  )
  const service: Service | undefined = useMemo(
    () => branch?.services.find((s) => s.code === serviceCode),
    [branch, serviceCode]
  )
  const isLaser = !!service?.usesLaserAreas

  /* cascading resets */
  const resetAfterBranch = useCallback(() => {
    setServiceCode(null)
    setGender(null)
    setAreas([])
    setDoctorId(null)
    setDate(null)
    setStartMin(null)
    setName("")
    setPhone("")
    setNote("")
    setBooked(false)
  }, [])
  const pickBranch = useCallback(
    (id: string) => {
      setBranchId(id)
      resetAfterBranch()
    },
    [resetAfterBranch]
  )
  const pickService = useCallback((code: string) => {
    setServiceCode(code)
    setAreas([])
    setDoctorId(null)
    setDate(null)
    setStartMin(null)
  }, [])
  const pickGender = useCallback((g: ClientGender) => {
    setGender(g)
    setAreas([])
    setDoctorId(null)
    setDate(null)
    setStartMin(null)
  }, [])
  const onToggleArea = useCallback(
    (code: string) => {
      setAreas((prev) => toggleArea(prev, code, cfg))
      setDoctorId(null)
      setDate(null)
      setStartMin(null)
    },
    [cfg]
  )
  const pickDoctor = useCallback((id: string) => {
    setDoctorId(id)
    setDate(null)
    setStartMin(null)
  }, [])
  const pickDate = useCallback((d: string) => {
    setDate(d)
    setStartMin(null)
  }, [])

  const ctxFor = useCallback(
    (wd: WizardBranch["doctors"][number]): DoctorContext => ({
      doctor: wd.doctor,
      schedules: wd.schedules,
      laserCutoffs: wd.laserCutoffs,
      branchLaserCutoffs: branch?.branchLaserCutoffs ?? [],
      rooms: wd.rooms,
      updates: branch?.updates ?? [],
    }),
    [branch]
  )

  const bikiniAlone = isLaser && companionMissing(areas, cfg.areas)
  const areasReady = !isLaser || (areas.length > 0 && !bikiniAlone)
  const duration = service ? sessionMinutes(service, areas, cfg) : 0

  // Doctor evaluations (date-independent) for the picker.
  const doctorEvals = useMemo(() => {
    if (!branch || !service || !gender || !areasReady) return []
    return branch.doctors.map((wd) => {
      const ctx = ctxFor(wd)
      const ruleReasons = doctorRuleReasons(ctx, { service, gender, areas }, cfg)
      let ok = ruleReasons.length === 0
      let reasons = ruleReasons
      let days: string[] = []
      if (ok) {
        days = availableDates(
          ctx,
          { today: todayStr, count: HORIZON_DAYS, service, gender, areas },
          cfg
        )
        if (days.length === 0) {
          ok = false
          reasons = ["مفيش مواعيد متاحة في الـ ١٤ يوم الجاية"]
        }
      }
      return {
        id: wd.doctor.id,
        name: wd.doctor.displayName,
        ok,
        reasons,
        notes: doctorNotes(wd.doctor),
        days,
      }
    })
  }, [branch, service, gender, areas, areasReady, cfg, ctxFor, todayStr])

  const selectedDoctor = useMemo(
    () => branch?.doctors.find((d) => d.doctor.id === doctorId),
    [branch, doctorId]
  )
  const selectedDoctorEval = doctorEvals.find((e) => e.id === doctorId)
  const availDays = selectedDoctorEval?.days ?? []

  const timeSlots = useMemo(() => {
    if (!selectedDoctor || !service || !date) return []
    return startSlots(ctxFor(selectedDoctor), { date, service, durationMin: duration }, cfg)
  }, [selectedDoctor, service, date, duration, cfg, ctxFor])

  const decision: Decision | null = useMemo(() => {
    if (!branch || !selectedDoctor || !service || !date) return null
    return decide({
      branchCode: branch.code,
      hasTickets: branch.hasTickets,
      doctor: selectedDoctor.doctor,
      serviceCode: service.code,
      date,
      today: todayStr,
      updates: branch.updates,
    })
  }, [branch, selectedDoctor, service, date, todayStr])

  const price: LaserPricing | null = useMemo(() => {
    if (!isLaser || !gender || areas.length === 0 || !branch) return null
    return laserAreaPricing(areas, gender, branch.priceBook, cfg)
  }, [isLaser, gender, areas, branch, cfg])

  const laserDur = isLaser ? laserMinutes(areas, cfg) : null

  const isTicket = decision?.ticket === "innova_ticket"
  const phoneValid = isEgyptMobile(phone)
  const complete = startMin != null && date != null
  const canSend = isTicket && complete && name.trim().length > 0 && phoneValid && booked && !sending

  const buildMsg = useCallback(() => {
    if (!branch || !selectedDoctor || !service || !gender || date == null || startMin == null)
      return ""
    return buildWhatsAppMessage({
      branchName: branch.nameAr,
      doctorName: selectedDoctor.doctor.displayName,
      serviceName: branch.serviceNames[service.code] ?? service.code,
      gender,
      areaCodes: areas,
      date,
      startMin,
      customerName: name,
      phone,
      cfg,
    })
  }, [branch, selectedDoctor, service, gender, date, startMin, areas, name, phone, cfg])

  const copyMessage = useCallback(async () => {
    const msg = buildMsg()
    if (!msg) return
    try {
      await navigator.clipboard.writeText(msg)
      toast.success("اتنسخت الرسالة")
    } catch {
      toast.error("مش قادر أنسخ — انسخ يدويًا")
    }
  }, [buildMsg])

  const onDone = useCallback(() => {
    resetAfterBranch()
    toast.success("تمام — ابدأ حجز جديد")
  }, [resetAfterBranch])

  const onSend = useCallback(async () => {
    if (!branch || !doctorId || !service || !gender || date == null || startMin == null) return
    setSending(true)
    const res = await sendTicket({
      branchId: branch.id,
      doctorId,
      serviceCode: service.code,
      gender,
      areaCodes: areas,
      date,
      startMin,
      customerName: name,
      phone,
      note,
    })
    setSending(false)
    if (res.ok) {
      toast.success(`اتبعت التيكت #${formatNumber(res.ticketNo)}`)
      router.push("/dashboard/tickets")
    } else {
      toast.error(res.error)
    }
  }, [branch, doctorId, service, gender, date, startMin, areas, name, phone, note, router])

  if (!branch) {
    return <p className="text-sm text-muted-foreground">لا توجد فروع متاحة.</p>
  }

  const genderAreas = gender ? areasFor(gender, cfg.areas) : []

  return (
    <div
      className={
        drawer
          ? "flex flex-col gap-4"
          : "grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start"
      }
    >
      {/* ---------- steps (right in RTL) ---------- */}
      <div className="space-y-4 min-w-0">
        {/* Innova branch mark */}
        {branch.logoUrl && (
          <div className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-4 py-3">
            <img
              src={branch.logoUrl}
              alt={branch.nameAr}
              className="h-7 w-auto max-w-[130px] object-contain object-right select-none"
              draggable={false}
            />
            <span className="text-xs text-muted-foreground border-s border-border ps-2.5">
              حجز لفرع {branch.nameAr}
            </span>
          </div>
        )}
        {/* 1 — branch */}
        <StepCard n={1} icon={<Building2 size={15} />} title="الفرع">
          <div className="flex flex-wrap gap-2">
            {data.branches.map((b) => (
              <Chip key={b.id} active={b.id === branchId} onClick={() => pickBranch(b.id)}>
                {b.nameAr}
              </Chip>
            ))}
          </div>
        </StepCard>

        {/* 2 — service */}
        <StepCard n={2} icon={<Sparkles size={15} />} title="الخدمة">
          {branch.services.length === 0 ? (
            <p className="text-xs text-muted-foreground">الفرع ده مفيهوش خدمات مسجلة.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {branch.services.map((s) => (
                <Chip
                  key={s.code}
                  active={s.code === serviceCode}
                  onClick={() => pickService(s.code)}
                >
                  {branch.serviceNames[s.code] ?? s.code}
                </Chip>
              ))}
            </div>
          )}
        </StepCard>

        {/* 3 — gender */}
        {service && (
          <StepCard n={3} icon={<User size={15} />} title="جنس العميل">
            <div className="flex flex-wrap gap-2">
              <Chip active={gender === "female"} onClick={() => pickGender("female")}>
                أنثى
              </Chip>
              <Chip active={gender === "male"} onClick={() => pickGender("male")}>
                ذكر
              </Chip>
            </div>
          </StepCard>
        )}

        {/* 4 — laser areas */}
        {service && gender && isLaser && (
          <StepCard n={4} icon={<Scan size={15} />} title="مناطق الليزر">
            <div className="flex flex-wrap gap-2">
              {genderAreas.map((a) => (
                <Chip key={a.code} active={areas.includes(a.code)} onClick={() => onToggleArea(a.code)}>
                  {a.hintAr ?? a.nameEn}
                  {a.durationMin > 0 && (
                    <span className="ms-1 text-[11px] opacity-70 tabular">
                      ({formatNumber(a.durationMin)} د)
                    </span>
                  )}
                </Chip>
              ))}
            </div>
            {areas.length > 0 && laserDur && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="text-foreground font-medium">
                  مدة الجلسة: {formatNumber(laserDur.total)} دقيقة
                </span>
                {laserDur.adjustments.map((adj, i) => (
                  <span key={i} className="text-muted-foreground">
                    {adj}
                  </span>
                ))}
              </div>
            )}
            {bikiniAlone && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--status-open)]">
                <AlertTriangle size={13} />
                Bikini Line لازم تتحجز مع أريا تانية — اختار معاها أريا.
              </p>
            )}
          </StepCard>
        )}

        {/* 5 — doctor */}
        {service && gender && areasReady && (
          <StepCard n={5} icon={<Stethoscope size={15} />} title="الدكتورة">
            <div className="space-y-2">
              {[...doctorEvals]
                .sort((a, b) => Number(b.ok) - Number(a.ok))
                .map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    disabled={!e.ok}
                    onClick={() => pickDoctor(e.id)}
                    className={cn(
                      "w-full text-start rounded-lg border p-3 transition-colors",
                      !e.ok
                        ? "opacity-60 bg-muted/40 border-border cursor-not-allowed"
                        : e.id === doctorId
                          ? "border-primary bg-accent"
                          : "border-border bg-card hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{e.name}</span>
                      {e.ok ? (
                        <span className="text-[11px] text-[var(--status-confirmed)] font-medium">
                          متاحة
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground font-medium">
                          غير متاحة
                        </span>
                      )}
                    </div>
                    {!e.ok && e.reasons.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">{e.reasons.join("، ")}</p>
                    )}
                    {e.ok &&
                      e.notes.map((n, i) => (
                        <p
                          key={i}
                          className="mt-1 flex items-start gap-1 text-[11px] text-[var(--status-open)]"
                        >
                          <Info size={11} className="mt-0.5 shrink-0" />
                          {n}
                        </p>
                      ))}
                  </button>
                ))}
            </div>
          </StepCard>
        )}

        {/* 6 — date + time */}
        {selectedDoctor && (
          <StepCard n={6} icon={<CalendarDays size={15} />} title="التاريخ والوقت">
            {availDays.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                مفيش أيام متاحة للدكتورة دي في الـ ١٤ يوم الجاية.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {availDays.map((d) => (
                    <Chip key={d} active={d === date} onClick={() => pickDate(d)}>
                      {dateChipLabel(d)}
                    </Chip>
                  ))}
                </div>
                {date && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      وقت البداية{" "}
                      <span className="text-foreground">
                        (مدة الجلسة {formatNumber(duration)} دقيقة)
                      </span>
                    </p>
                    {timeSlots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">مفيش أوقات تكفي مدة الجلسة.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {timeSlots.map((t) => (
                          <Chip key={t} active={t === startMin} onClick={() => setStartMin(t)}>
                            <span className="tabular">{tLabel(t)}</span>
                          </Chip>
                        ))}
                      </div>
                    )}
                    {startMin != null && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        من <b className="text-foreground tabular">{tLabel(startMin)}</b> لحد{" "}
                        <b className="text-foreground tabular">{tLabel(startMin + duration)}</b>
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </StepCard>
        )}

        {/* decision + send */}
        {decision && complete && (
          <DecisionCard
            decision={decision}
            isTicket={isTicket}
            name={name}
            phone={phone}
            phoneValid={phoneValid}
            note={note}
            booked={booked}
            sending={sending}
            canSend={canSend}
            onName={setName}
            onPhone={setPhone}
            onNote={setNote}
            onBooked={setBooked}
            onSend={onSend}
            onDone={onDone}
            onCopy={copyMessage}
          />
        )}
      </div>

      {/* ---------- live summary (left in RTL; stacks under steps in a drawer) ---------- */}
      <SummaryPanel
        sticky={!drawer}
        branchName={branch.nameAr}
        serviceName={service ? branch.serviceNames[service.code] ?? service.code : null}
        gender={gender}
        isLaser={isLaser}
        areaLabels={areas.map((c) => {
          const a = cfg.areas.find((x) => x.code === c)
          return a?.hintAr ?? a?.nameEn ?? c
        })}
        duration={areasReady && service ? duration : null}
        price={price}
        doctorName={selectedDoctor?.doctor.displayName ?? null}
        dateLabel={date ? whenLabel(date, todayStr) : null}
        timeLabel={startMin != null ? `${tLabel(startMin)} – ${tLabel(startMin + duration)}` : null}
        decision={decision}
        isTicket={isTicket}
      />
    </div>
  )
}

/* ---------- decision card ------------------------------------------ */

function StatusBadge({ status }: { status: "Open" | "Confirmed" }) {
  const confirmed = status === "Confirmed"
  const bg = confirmed ? "var(--status-confirmed-bg)" : "var(--status-open-bg)"
  const fg = confirmed ? "var(--status-confirmed)" : "var(--status-open)"
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ backgroundColor: bg, color: fg }}
    >
      {status}
    </span>
  )
}

function DecisionCard({
  decision,
  isTicket,
  name,
  phone,
  phoneValid,
  note,
  booked,
  sending,
  canSend,
  onName,
  onPhone,
  onNote,
  onBooked,
  onSend,
  onDone,
  onCopy,
}: {
  decision: Decision
  isTicket: boolean
  name: string
  phone: string
  phoneValid: boolean
  note: string
  booked: boolean
  sending: boolean
  canSend: boolean
  onName: (v: string) => void
  onPhone: (v: string) => void
  onNote: (v: string) => void
  onBooked: (v: boolean) => void
  onSend: () => void
  onDone: () => void
  onCopy: () => void
}) {
  const accent = isTicket ? "var(--status-request)" : "var(--border)"
  return (
    <section className="rounded-xl border-2 p-4 bg-card" style={{ borderColor: accent }}>
      <div className="flex items-center gap-2 flex-wrap">
        {isTicket && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ backgroundColor: "var(--status-request)", color: "white" }}
          >
            تيكت إينوفا
          </span>
        )}
        <h3 className="text-base font-bold text-foreground">
          {isTicket ? "سجّل التيكت بعد ما تحجز في Dentolize" : "خطوات الحجز"}
        </h3>
      </div>

      <p className="mt-2 text-sm text-foreground flex items-center gap-2">
        حالة Dentolize: <StatusBadge status={decision.status} />
        {decision.statusNote && (
          <span className="text-xs text-muted-foreground">— {decision.statusNote}</span>
        )}
      </p>

      {/* steps */}
      {decision.steps.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {decision.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="text-primary font-semibold tabular shrink-0 w-5">
                {formatNumber(i + 1)}.
              </span>
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      )}

      {/* info */}
      {decision.info.map((t, i) => (
        <p key={`i-${i}`} className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info size={12} className="mt-0.5 shrink-0 text-primary/70" />
          {t}
        </p>
      ))}

      {/* warns */}
      {decision.warns.map((t, i) => (
        <p
          key={`w-${i}`}
          className="mt-2 flex items-start gap-1.5 text-xs font-medium text-[var(--status-open)]"
        >
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {t}
        </p>
      ))}

      {/* ticket form (Innova today/tomorrow only) */}
      {isTicket && (
        <>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">اسم العميل</label>
              <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="الاسم" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">رقم الموبايل</label>
              <Input
                value={phone}
                onChange={(e) => onPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                inputMode="tel"
                dir="ltr"
                aria-invalid={phone.length > 0 && !phoneValid}
              />
              {phone.length > 0 && !phoneValid && (
                <p className="mt-0.5 text-[11px] text-destructive">رقم موبايل مصري غير صحيح</p>
              )}
            </div>
          </div>
          <div className="mt-2">
            <label className="text-xs font-medium text-muted-foreground">ملاحظة (اختياري)</label>
            <Input value={note} onChange={(e) => onNote(e.target.value)} placeholder="ملاحظة للفرع" />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={booked}
              onChange={(e) => onBooked(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            حجزت على Dentolize
          </label>
        </>
      )}

      {/* actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isTicket ? (
          <button
            type="button"
            disabled={!canSend}
            onClick={onSend}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            سجّل تيكت
          </button>
        ) : (
          <button
            type="button"
            onClick={onDone}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:bg-[var(--primary-hover)] transition-colors"
          >
            <Check size={15} />
            تم الحجز
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-card border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
        >
          <Copy size={15} />
          نسخ الرسالة
        </button>
      </div>
    </section>
  )
}

/* ---------- summary panel ------------------------------------------ */

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-foreground text-start">{value}</span>
    </div>
  )
}

function SummaryPanel({
  sticky,
  branchName,
  serviceName,
  gender,
  isLaser,
  areaLabels,
  duration,
  price,
  doctorName,
  dateLabel,
  timeLabel,
  decision,
  isTicket,
}: {
  sticky: boolean
  branchName: string
  serviceName: string | null
  gender: ClientGender | null
  isLaser: boolean
  areaLabels: string[]
  duration: number | null
  price: LaserPricing | null
  doctorName: string | null
  dateLabel: string | null
  timeLabel: string | null
  decision: Decision | null
  isTicket: boolean
}) {
  return (
    <aside className={cn("bg-card border border-border rounded-xl p-4", sticky && "lg:sticky lg:top-0")}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-3">
        <Check size={15} className="text-primary" />
        ملخّص الحجز
      </h3>
      <div className="space-y-0">
        <SummaryRow label="الفرع" value={branchName} />
        {serviceName && <SummaryRow label="الخدمة" value={serviceName} />}
        {gender && <SummaryRow label="الجنس" value={gender === "male" ? "ذكر" : "أنثى"} />}
        {isLaser && areaLabels.length > 0 && (
          <SummaryRow label="المناطق" value={areaLabels.join("، ")} />
        )}
        {duration != null && duration > 0 && (
          <SummaryRow label="المدة" value={`${formatNumber(duration)} دقيقة`} />
        )}
        {doctorName && <SummaryRow label="الدكتورة" value={doctorName} />}
        {dateLabel && <SummaryRow label="التاريخ" value={dateLabel} />}
        {timeLabel && (
          <SummaryRow label="الوقت" value={<span className="tabular">{timeLabel}</span>} />
        )}
      </div>

      {price && (price.lines.length > 0 || price.noStandalone.length > 0) && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">سعر الليزر</p>
          {price.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-0.5">
              <span className="text-foreground">{l.label}</span>
              <span className="tabular text-foreground">يبدأ من {formatEgp(l.single)}</span>
            </div>
          ))}
          {price.lines.length > 0 && (
            <div className="flex items-center justify-between text-xs font-bold mt-1 pt-1 border-t border-border/60">
              <span>الإجمالي (جلسة)</span>
              <span className="tabular">{formatEgp(price.singleTotal)}</span>
            </div>
          )}
          {price.package3Total != null && (
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
              <span>باكدج ٣ جلسات</span>
              <span className="tabular">{formatEgp(price.package3Total)}</span>
            </div>
          )}
          {price.noStandalone.map((u, i) => (
            <p key={i} className="mt-1 text-[11px] text-muted-foreground">
              {u.label}: مفيش سعر لوحدها
              {u.bundle ? ` — بتتحسب مع «${u.bundle.label}»` : ""}
              {u.pulse != null ? ` أو ${formatNumber(u.pulse)} ج / نبضة` : ""}.
            </p>
          ))}
        </div>
      )}

      {decision && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
          <StatusBadge status={decision.status} />
          {isTicket && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ backgroundColor: "var(--status-request-bg)", color: "var(--status-request)" }}
            >
              تيكت إينوفا
            </span>
          )}
        </div>
      )}
    </aside>
  )
}
