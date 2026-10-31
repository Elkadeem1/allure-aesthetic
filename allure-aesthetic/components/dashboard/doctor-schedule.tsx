"use client"

import { useEffect, useState } from "react"
import {
  Info,
  DoorOpen,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  CalendarDays,
  Clock,
  RefreshCw,
} from "lucide-react"
import { cn } from "cn"
import { formatDayMonth } from "@/lib/format"
import { hm } from "@/lib/engine"
import {
  DAY_LABELS,
  OFF_LABEL,
  dayInfo,
  kindMeta,
  ruleTags,
  segLabel,
  timeLabel,
  weekDates,
  weekdaySat0,
  type DayInfo,
  type RuleTag,
  type Seg,
} from "./schedule-utils"
import type { DoctorData, DoctorUpdate } from "./types"

/* ---------- small shared bits ---------- */

const TAG_STYLE: Record<RuleTag["cls"], string> = {
  rose: "bg-[var(--rose-tint)] text-[var(--rose-deep)]",
  gold: "bg-[var(--gold-tint)] text-[var(--gold)]",
  sage: "bg-[var(--sage-tint)] text-[var(--sage)]",
  grey: "bg-[var(--status-notice-bg)] text-[var(--status-notice)]",
}

function Dot({ kind }: { kind: string }) {
  return (
    <span
      className="inline-block size-1.5 rounded-full shrink-0 me-1 align-middle"
      style={{ backgroundColor: kindMeta(kind).dot }}
    />
  )
}

function DoctorTags({ doctor }: { doctor: DoctorData }) {
  const tags = ruleTags(doctor)
  if (!doctor.specialty && tags.length === 0) return null
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {doctor.specialty && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--rose-tint)] text-[var(--rose-deep)] font-medium">
          🩷 {doctor.specialty}
        </span>
      )}
      {tags.map((t, i) => (
        <span
          key={i}
          title={t.tip}
          className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", TAG_STYLE[t.cls])}
        >
          {t.label}
        </span>
      ))}
    </span>
  )
}

/* ---------- TODAY / TOMORROW strip ---------- */

function cutoffTags(inf: DayInfo) {
  return (
    <>
      {inf.hours && (
        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[var(--status-request-bg)] text-[var(--status-request)] font-medium">
          <RefreshCw size={9} /> ساعات مختلفة
        </span>
      )}
      {inf.cutoff?.atTime && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--status-open-bg)] text-[var(--status-open)] font-medium">
          ⛔ الحجز لحد {timeLabel(hm(inf.cutoff.atTime))}
        </span>
      )}
      {inf.laserStop?.atTime && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--status-open-bg)] text-[var(--status-open)] font-medium">
          🚫 ليزر لحد {timeLabel(hm(inf.laserStop.atTime))}
        </span>
      )}
    </>
  )
}

function DayCard({
  label,
  dateStr,
  now,
  doctors,
  updates,
}: {
  label: string
  dateStr: string
  now: boolean
  doctors: DoctorData[]
  updates: DoctorUpdate[]
}) {
  const rows = doctors
    .map((d) => ({ d, inf: dayInfo(d, dateStr, updates) }))
    .filter((r) => r.inf.off || r.inf.segs.length > 0)
  const dn = DAY_LABELS[weekdaySat0(dateStr)]

  return (
    <div className={cn("flex-1 bg-card border rounded-xl overflow-hidden", now ? "border-primary/40" : "border-border")}>
      <div className={cn("px-4 py-2 border-b border-border text-xs font-semibold", now ? "bg-accent text-primary" : "bg-muted/40 text-foreground")}>
        {now && <span className="me-1">📍</span>}
        {label} — {dn} {formatDayMonth(new Date(dateStr + "T00:00:00"))}
      </div>
      <div className="p-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">مفيش دكاترة مسجلة اليوم ده.</p>
        ) : (
          rows.map(({ d, inf }) => (
            <div key={d.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <b className="text-foreground">{d.displayName}</b>
              {inf.off ? (
                <>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--status-breach-bg)] text-[var(--status-breach)] font-semibold">
                    ⛔ {OFF_LABEL[inf.off.type] ?? inf.off.type}
                  </span>
                  {inf.off.note && <span className="text-muted-foreground">{inf.off.note}</span>}
                </>
              ) : (
                <>
                  <span className="text-muted-foreground tabular">
                    {inf.segs.map((s) => segLabel(s)).join(" ، ")}
                  </span>
                  {cutoffTags(inf)}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function TodayStrip({
  doctors,
  updates,
  todayStr,
}: {
  doctors: DoctorData[]
  updates: DoctorUpdate[]
  todayStr: string
}) {
  const tmr = new Date(todayStr + "T00:00:00")
  tmr.setDate(tmr.getDate() + 1)
  const tomorrowStr = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, "0")}-${String(tmr.getDate()).padStart(2, "0")}`

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <DayCard label="النهاردة" dateStr={todayStr} now doctors={doctors} updates={updates} />
      <DayCard label="بكرة" dateStr={tomorrowStr} now={false} doctors={doctors} updates={updates} />
    </div>
  )
}

/* ---------- WEEK TABLE ---------- */

function WeekCell({ inf, other, isToday }: { inf: DayInfo | null; other: boolean; isToday: boolean }) {
  const base = isToday ? "bg-accent/30" : ""
  if (other) {
    return (
      <td className={cn("px-1.5 py-2 text-center text-muted-foreground/50", base)} title="في غرفة تانية">
        –
      </td>
    )
  }
  if (!inf || (!inf.off && inf.segs.length === 0)) {
    return (
      <td className={cn("px-1.5 py-2 text-center", base)}>
        <span className="text-muted-foreground/30">—</span>
      </td>
    )
  }
  if (inf.off) {
    return (
      <td className={cn("px-1.5 py-2 text-center bg-[var(--status-breach-bg)]", isToday && "ring-1 ring-inset ring-primary/30")} title={inf.off.note ?? undefined}>
        <span className="font-semibold text-[var(--status-breach)]">⛔ {OFF_LABEL[inf.off.type] ?? inf.off.type}</span>
      </td>
    )
  }
  return (
    <td
      className={cn(
        "px-1.5 py-2 text-start align-top",
        base,
        inf.overridden && "border border-dashed border-[var(--status-request)]"
      )}
      title={inf.overridden ? "ساعات مختلفة — Update من الفرع" : undefined}
    >
      {inf.segs.map((s, i) => (
        <div key={i} className="text-foreground leading-tight whitespace-nowrap">
          <Dot kind={s.kind} />
          <span className="tabular">{segLabel(s)}</span>
        </div>
      ))}
      {(inf.hours || inf.cutoff || inf.laserStop) && (
        <div className="mt-1 flex flex-col gap-0.5 items-start">{cutoffTags(inf)}</div>
      )}
    </td>
  )
}

function WeekTable({
  title,
  roomId,
  doctors,
  updates,
  dates,
  todayStr,
}: {
  title: string | null
  roomId: string | null
  doctors: DoctorData[]
  updates: DoctorUpdate[]
  dates: string[]
  todayStr: string
}) {
  if (doctors.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        {title ? `مفيش دكاترة مسجلة في ${title}.` : "لا يوجد أطباء مسجلون لهذا الفرع."}
      </div>
    )
  }
  return (
    <div>
      {title && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-muted/30 text-xs font-semibold text-foreground">
          <DoorOpen size={13} className="text-primary/70" />
          {title}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-end px-3 py-2.5 font-semibold text-muted-foreground bg-muted/40 w-36 sticky end-0 z-10">الطبيب</th>
              {dates.map((dateStr, i) => {
                const isToday = dateStr === todayStr
                return (
                  <th key={i} className={cn("px-2 py-2.5 font-semibold text-center", isToday ? "bg-accent text-primary" : "text-muted-foreground bg-muted/20")}>
                    <div>{DAY_LABELS[i]}</div>
                    <div className={cn("text-[10px] mt-0.5 tabular font-normal", isToday ? "text-primary/80" : "text-muted-foreground/70")}>
                      {formatDayMonth(new Date(dateStr + "T00:00:00"))}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {doctors.map((doctor, di) => (
              <tr key={doctor.id} className={cn(di < doctors.length - 1 && "border-b border-border", "hover:bg-muted/10")}>
                <td className="px-3 py-2 align-top bg-muted/10 sticky end-0 z-10">
                  <span className="font-medium text-foreground">{doctor.displayName}</span>
                  <DoctorTags doctor={doctor} />
                </td>
                {dates.map((dateStr, dayIdx) => {
                  const weekday = dayIdx
                  const inThisRoom = !roomId || doctor.rooms.some((r) => r.weekday === weekday && r.roomId === roomId)
                  const assignedElsewhere = !!roomId && !inThisRoom && doctor.rooms.some((r) => r.weekday === weekday)
                  const inf = inThisRoom ? dayInfo(doctor, dateStr, updates) : null
                  return <WeekCell key={dayIdx} inf={inf} other={assignedElsewhere} isToday={dateStr === todayStr} />
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- DAY TIMELINE ---------- */

const T0 = 9 * 60 // 9 ص
const T1 = 23 * 60 // 11 م
const pos = (m: number) => Math.max(0, Math.min(100, ((m - T0) / (T1 - T0)) * 100))

function TimelineRow({ doctor, inf, nowMin }: { doctor: DoctorData; inf: DayInfo; nowMin: number | null }) {
  const bars: React.ReactNode[] = []
  if (inf.off) {
    bars.push(
      <div key="off" className="absolute inset-y-0 start-0 end-0 flex items-center justify-center text-[11px] font-semibold text-[var(--status-breach)] bg-[var(--status-breach-bg)] rounded">
        ⛔ {OFF_LABEL[inf.off.type] ?? inf.off.type}
        {inf.off.note ? ` — ${inf.off.note}` : ""}
      </div>
    )
  } else {
    inf.segs.forEach((seg: Seg, i) => {
      let to = seg.to
      if (inf.cutoff?.atTime) to = Math.min(to, Math.max(seg.from, hm(inf.cutoff.atTime)))
      if (to <= seg.from) return
      const left = pos(seg.from)
      const width = pos(to) - left
      bars.push(
        <div
          key={`b${i}`}
          className={cn("absolute inset-y-1 rounded flex items-center justify-center text-[10px] text-white overflow-hidden px-1", inf.hours && "ring-1 ring-dashed ring-white/70")}
          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: kindMeta(seg.kind).dot }}
          title={segLabel({ from: seg.from, to, kind: seg.kind })}
        >
          <span className="tabular truncate">{timeLabel(seg.from)}–{timeLabel(to)}</span>
        </div>
      )
      if (inf.laserStop?.atTime && (seg.kind === "laser" || seg.kind === "all")) {
        const f = Math.max(seg.from, hm(inf.laserStop.atTime))
        if (f < to) {
          bars.push(
            <div
              key={`ns${i}`}
              className="absolute inset-y-1 rounded"
              style={{
                left: `${pos(f)}%`,
                width: `${pos(to) - pos(f)}%`,
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgba(192,57,43,.85), rgba(192,57,43,.85) 3px, rgba(192,57,43,.4) 3px, rgba(192,57,43,.4) 6px)",
              }}
              title={`ممنوع ليزر بعد ${timeLabel(hm(inf.laserStop.atTime))}`}
            />
          )
        }
      }
    })
  }
  const tags = ruleTags(doctor).slice(0, 3)
  const showNow = nowMin != null && nowMin >= T0 && nowMin <= T1
  return (
    <div className="flex items-stretch gap-2 py-1">
      <div className="w-36 shrink-0 text-xs">
        <span className="font-medium text-foreground">{doctor.displayName}</span>
        {tags.length > 0 && (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {tags.map((t, i) => (
              <span key={i} className={cn("text-[9px] px-1 py-0.5 rounded", TAG_STYLE[t.cls])}>{t.label}</span>
            ))}
          </span>
        )}
      </div>
      <div className="relative flex-1 h-8 rounded bg-muted/40" dir="ltr">
        {bars}
        {showNow && <div className="absolute inset-y-0 w-0.5 bg-[var(--status-breach)] z-10" style={{ left: `${pos(nowMin!)}%` }} />}
      </div>
    </div>
  )
}

function Legend({ showNow }: { showNow: boolean }) {
  const item = (style: React.CSSProperties, label: string) => (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <i className="inline-block w-3 h-3 rounded-sm" style={style} />
      {label}
    </span>
  )
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 py-3 border-t border-border">
      {item({ background: "var(--rose)" }, "كل الخدمات")}
      {item({ background: "var(--gold)" }, "ليزر")}
      {item({ background: "var(--sage)" }, "باقي الخدمات")}
      {item({ background: "var(--status-notice)" }, "جلدية")}
      {item(
        { backgroundImage: "repeating-linear-gradient(45deg, rgba(192,57,43,.85), rgba(192,57,43,.85) 3px, rgba(192,57,43,.4) 3px, rgba(192,57,43,.4) 6px)" },
        "ليزر موقوف"
      )}
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <i className="inline-block w-3 h-3 rounded-sm border border-dashed border-foreground/60" /> حدود متقطعة = Update
      </span>
      {showNow && item({ background: "var(--status-breach)", width: "3px" }, "الوقت دلوقتي")}
    </div>
  )
}

function DayTimeline({
  branch,
  dates,
  todayStr,
  dayIdx,
  setDayIdx,
  updates,
}: {
  branch: { doctors: DoctorData[]; rooms: { id: string; title: string }[] }
  dates: string[]
  todayStr: string
  dayIdx: number
  setDayIdx: (i: number) => void
  updates: DoctorUpdate[]
}) {
  const [nowMin, setNowMin] = useState<number | null>(null)
  const dateStr = dates[dayIdx]
  const weekday = weekdaySat0(dateStr)
  const isToday = dateStr === todayStr

  useEffect(() => {
    if (!isToday) {
      setNowMin(null)
      return
    }
    const calc = () => {
      const s = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo", hour12: false, hour: "2-digit", minute: "2-digit" })
      const [h, m] = s.split(":").map(Number)
      setNowMin((h % 24) * 60 + m)
    }
    calc()
    const id = setInterval(calc, 60_000)
    return () => clearInterval(id)
  }, [isToday, dateStr])

  const rowsAll = branch.doctors.map((d) => ({ d, inf: dayInfo(d, dateStr, updates) }))
  const active = rowsAll.filter((r) => r.inf.off || r.inf.segs.length > 0)
  const absent = rowsAll.filter((r) => !r.inf.off && r.inf.segs.length === 0)

  const inRoom = (d: DoctorData, roomId: string) => d.rooms.some((r) => r.weekday === weekday && r.roomId === roomId)

  const axisTicks: React.ReactNode[] = []
  for (let m = T0; m <= T1; m += 120) {
    axisTicks.push(
      <span key={m} className="absolute -translate-x-1/2 text-[10px] text-muted-foreground tabular" style={{ left: `${pos(m)}%` }}>
        {timeLabel(m)}
      </span>
    )
  }

  const renderRows = (rows: typeof active) =>
    rows.map(({ d, inf }) => <TimelineRow key={d.id} doctor={d} inf={inf} nowMin={nowMin} />)

  return (
    <div>
      {/* day buttons */}
      <div className="flex flex-wrap gap-1 px-4 py-3 border-b border-border">
        {dates.map((ds, i) => (
          <button
            key={i}
            onClick={() => setDayIdx(i)}
            className={cn(
              "text-xs font-medium px-2.5 py-1 rounded-lg transition-colors",
              i === dayIdx
                ? "bg-primary text-primary-foreground"
                : ds === todayStr
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:bg-muted"
            )}
          >
            {DAY_LABELS[i]} <span className="tabular">{formatDayMonth(new Date(ds + "T00:00:00"))}</span>
          </button>
        ))}
      </div>

      <div className="p-4 space-y-1">
        {/* axis */}
        <div className="flex items-stretch gap-2">
          <div className="w-36 shrink-0" />
          <div className="relative flex-1 h-5" dir="ltr">{axisTicks}</div>
        </div>

        {branch.rooms.length > 0 ? (
          branch.rooms.map((room) => {
            const rr = active.filter((x) => inRoom(x.d, room.id))
            return (
              <div key={room.id} className="pt-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground py-1">
                  <DoorOpen size={13} className="text-primary/70" />
                  {room.title}
                </div>
                {rr.length > 0 ? renderRows(rr) : <p className="text-xs text-muted-foreground ps-2">مفيش دكاترة في الغرفة دي اليوم ده.</p>}
              </div>
            )
          })
        ) : active.length > 0 ? (
          renderRows(active)
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">مفيش دكاترة مسجلة اليوم ده.</p>
        )}

        {absent.length > 0 && (
          <p className="text-[11px] text-muted-foreground pt-2">
            مش شغالين {DAY_LABELS[weekday]}: {absent.map((r) => r.d.displayName).join("، ")}
          </p>
        )}
      </div>

      <Legend showNow={nowMin != null} />
    </div>
  )
}

/* ---------- BRANCH SCHEDULE (toggle + week nav + views) ---------- */

export function BranchSchedule({
  branch,
  todayStr,
  updates,
}: {
  branch: { doctors: DoctorData[]; rooms: RoomList }
  todayStr: string
  updates: DoctorUpdate[]
}) {
  const [view, setView] = useState<"week" | "day">("week")
  const [weekOffset, setWeekOffset] = useState(0)
  const [dayIdx, setDayIdx] = useState<number | null>(null)

  const dates = weekDates(todayStr, weekOffset)
  const todayIdx = dates.indexOf(todayStr)
  const activeDayIdx = dayIdx != null ? dayIdx : todayIdx >= 0 ? todayIdx : 0

  // Reset the selected day when the week changes.
  const setWeek = (n: number) => {
    setWeekOffset(n)
    setDayIdx(null)
  }

  const roomTables =
    branch.rooms.length > 0
      ? branch.rooms.map((room) => ({
          title: room.title,
          roomId: room.id,
          doctors: branch.doctors.filter((d) => d.rooms.some((r) => r.roomId === room.id)),
        }))
      : [{ title: null as string | null, roomId: null as string | null, doctors: branch.doctors }]

  const Toggle = ({ v, icon, label }: { v: "week" | "day"; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setView(v)}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
        view === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
      )}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      {/* controls */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          <Toggle v="week" icon={<CalendarDays size={13} />} label="جدول الأسبوع" />
          <Toggle v="day" icon={<Clock size={13} />} label="حسب اليوم" />
        </div>
        {/* week nav — right points to the past, left to the future in RTL */}
        <div className="flex items-center gap-1">
          <button onClick={() => setWeek(weekOffset - 1)} title="الأسبوع الماضي" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight size={15} />
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeek(0)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-primary hover:bg-accent transition-colors">
              <RotateCcw size={12} /> اليوم
            </button>
          )}
          <button onClick={() => setWeek(weekOffset + 1)} title="الأسبوع التالي" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft size={15} />
          </button>
        </div>
      </div>

      {view === "week" ? (
        <div className="divide-y divide-border">
          {roomTables.map((rt) => (
            <WeekTable
              key={rt.roomId ?? "all"}
              title={rt.title}
              roomId={rt.roomId}
              doctors={rt.doctors}
              updates={updates}
              dates={dates}
              todayStr={todayStr}
            />
          ))}
        </div>
      ) : (
        <DayTimeline
          branch={branch}
          dates={dates}
          todayStr={todayStr}
          dayIdx={activeDayIdx}
          setDayIdx={setDayIdx}
          updates={updates}
        />
      )}

      {/* doctor notes */}
      {branch.doctors.some((d) => d.notes) && (
        <div className="border-t border-border px-4 py-3 space-y-1.5">
          {branch.doctors
            .filter((d) => d.notes)
            .map((d) => (
              <div key={d.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info size={12} className="mt-0.5 shrink-0 text-primary/60" />
                <span>
                  <span className="font-medium text-foreground">{d.displayName}:</span> {d.notes}
                </span>
              </div>
            ))}
        </div>
      )}
    </section>
  )
}

type RoomList = { id: string; title: string }[]
