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
  doctorNotes,
  doctorRuleReasons,
  evalDoctor,
  laserMinutes,
  laserPrice,
  resolveTicketKind,
  sessionMinutes,
  startSlots,
  tLabel,
  toggleArea,
  weekdaySat0,
  type DoctorContext,
  type Service,
} from "@/lib/engine"
import type { BookingData, WizardBranch } from "@/lib/booking/data"
import {
  buildWhatsAppMessage,
  decisionCardCopy,
  decisionReasonText,
  isEgyptMobile,
} from "@/lib/booking/message"
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

/* ---------- wizard -------------------------------------------------- */

export function BookingWizard({
  data,
  initialBranchId,
}: {
  data: BookingData
  initialBranchId?: string
}) {
  const router = useRouter()
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
  const pickBranch = useCallback((id: string) => {
    setBranchId(id)
    setServiceCode(null)
    setGender(null)
    setAreas([])
    setDoctorId(null)
    setDate(null)
    setStartMin(null)
  }, [])
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
    (doctorIdx: WizardBranch["doctors"][number]): DoctorContext => ({
      doctor: doctorIdx.doctor,
      schedules: doctorIdx.schedules,
      laserCutoffs: doctorIdx.laserCutoffs,
      branchLaserCutoffs: branch?.branchLaserCutoffs ?? [],
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

  const decision = useMemo(() => {
    if (!branch || !selectedDoctor || !date) return null
    return resolveTicketKind(
      selectedDoctor.doctor,
      date,
      todayStr,
      branch.updates,
      branch.policy
    )
  }, [branch, selectedDoctor, date, todayStr])

  const price = useMemo(() => {
    if (!isLaser || areas.length === 0) return null
    return laserPrice(areas, branch?.laserPrices ?? [], cfg)
  }, [isLaser, areas, branch, cfg])

  const laserDur = isLaser ? laserMinutes(areas, cfg) : null

  const copy = decision ? decisionCardCopy(decision.kind) : null
  const phoneValid = isEgyptMobile(phone)
  const complete = startMin != null && date != null
  const canSend =
    !!copy?.canSend && complete && name.trim().length > 0 && phoneValid && booked && !sending

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
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
      {/* ---------- steps (right in RTL) ---------- */}
      <div className="space-y-4 min-w-0">
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
        {decision && copy && complete && (
          <DecisionCard
            copy={copy}
            reason={decisionReasonText(decision.reason, {
              doctorName: selectedDoctor!.doctor.displayName,
              whenLabel: whenLabel(date!, todayStr),
            })}
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
            onCopy={copyMessage}
          />
        )}
      </div>

      {/* ---------- live summary (left in RTL) ---------- */}
      <SummaryPanel
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
        tone={copy?.tone ?? null}
      />
    </div>
  )
}

/* ---------- decision card ------------------------------------------ */

const TONE_STYLE = {
  request: { bg: "var(--status-request-bg)", fg: "var(--status-request)", label: "طلب" },
  notice: { bg: "var(--status-notice-bg)", fg: "var(--status-notice)", label: "إشعار" },
  no_ticket: { bg: "var(--status-open-bg)", fg: "var(--status-open)", label: "من غير تيكت" },
} as const

function DecisionCard({
  copy,
  reason,
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
  onCopy,
}: {
  copy: ReturnType<typeof decisionCardCopy>
  reason: string
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
  onCopy: () => void
}) {
  const t = TONE_STYLE[copy.tone]
  return (
    <section
      className="rounded-xl border-2 p-4"
      style={{ backgroundColor: t.bg, borderColor: t.fg }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
          style={{ backgroundColor: t.fg, color: "white" }}
        >
          {t.label}
        </span>
        <h3 className="text-base font-bold" style={{ color: t.fg }}>
          {copy.title}
        </h3>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{copy.instruction}</p>
      {reason && <p className="mt-1 text-xs text-muted-foreground">{reason}</p>}
      <p className="mt-2 text-xs text-foreground">
        حالة Dentolize:{" "}
        <b className="font-bold" style={{ color: t.fg }}>
          {copy.dentolizeLabel}
        </b>
      </p>

      {/* customer form */}
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

      {copy.canSend && (
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={booked}
            onChange={(e) => onBooked(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          حجزت على Dentolize
        </label>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {copy.canSend && (
          <button
            type="button"
            disabled={!canSend}
            onClick={onSend}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {copy.tone === "request" ? "ابعت الطلب" : "ابعت الإشعار"}
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
  tone,
}: {
  branchName: string
  serviceName: string | null
  gender: ClientGender | null
  isLaser: boolean
  areaLabels: string[]
  duration: number | null
  price: ReturnType<typeof laserPrice> | null
  doctorName: string | null
  dateLabel: string | null
  timeLabel: string | null
  tone: "request" | "notice" | "no_ticket" | null
}) {
  return (
    <aside className="lg:sticky lg:top-0 bg-card border border-border rounded-xl p-4">
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

      {price && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">سعر الليزر</p>
          {price.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-0.5">
              <span className="text-foreground">{l.label}</span>
              <span className="tabular text-foreground">يبدأ من {formatEgp(l.single)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs font-bold mt-1 pt-1 border-t border-border/60">
            <span>الإجمالي (جلسة)</span>
            <span className="tabular">{formatEgp(price.singleTotal)}</span>
          </div>
          {price.package3Total != null && (
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
              <span>باكدج ٣ جلسات</span>
              <span className="tabular">{formatEgp(price.package3Total)}</span>
            </div>
          )}
          {price.unpriced.length > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              فيه مناطق سعرها مش متسجل — اسأل الفرع.
            </p>
          )}
        </div>
      )}

      {tone && (
        <div className="mt-3 pt-3 border-t border-border">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ backgroundColor: TONE_STYLE[tone].bg, color: TONE_STYLE[tone].fg }}
          >
            {TONE_STYLE[tone].label}
          </span>
        </div>
      )}
    </aside>
  )
}
