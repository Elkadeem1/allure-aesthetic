"use client"

import { ChevronRight, ChevronLeft, RotateCcw, Info } from "lucide-react"
import { formatTime, formatDayMonth } from "@/lib/format"
import type { DoctorData, DoctorUpdate } from "./types"

const DAY_LABELS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]

const UPDATE_CELL_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  off:        { bg: "bg-[var(--status-breach-bg)]",  text: "text-[var(--status-breach)]",  label: "غايبة" },
  stop:       { bg: "bg-[var(--status-open-bg)]",    text: "text-[var(--status-open)]",    label: "وقف حجز" },
  hours:      { bg: "bg-[var(--status-request-bg)]", text: "text-[var(--status-request)]", label: "ساعات مختلفة" },
  open_slot:  { bg: "bg-[var(--status-confirmed-bg)]", text: "text-[var(--status-confirmed)]", label: "الدور فاضي" },
  note:       { bg: "bg-[var(--status-notice-bg)]",  text: "text-[var(--status-notice)]",  label: "ملاحظة" },
}

function getWeekDates(weekOffset: number): Date[] {
  const now = new Date()
  // shift to Cairo: approximate via UTC+2 offset for display
  const cairoNow = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" }))
  const dayOfWeek = (cairoNow.getDay() + 1) % 7  // sat=0
  const saturday = new Date(cairoNow)
  saturday.setDate(cairoNow.getDate() - dayOfWeek + weekOffset * 7)
  saturday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(saturday)
    d.setDate(saturday.getDate() + i)
    return d
  })
}

function dateToStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function getActiveUpdate(doctorId: string, dateStr: string, updates: DoctorUpdate[]) {
  return updates.find(
    (u) => u.doctorId === doctorId && u.dateFrom <= dateStr && u.dateTo >= dateStr
  ) ?? null
}

type Props = {
  doctors: DoctorData[]
  doctorUpdates: DoctorUpdate[]
  weekOffset: number
  todayStr: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function DoctorScheduleTable({
  doctors,
  doctorUpdates,
  weekOffset,
  todayStr,
  onPrev,
  onNext,
  onToday,
}: Props) {
  const weekDates = getWeekDates(weekOffset)

  if (doctors.length === 0) {
    return (
      <section className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
        لا يوجد أطباء مسجلون لهذا الفرع
      </section>
    )
  }

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Table header: title + week nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">جدول الأطباء</h2>
        {/* RTL week nav: reads right→left as previous / اليوم / next. Past points
            right (ChevronRight), future points left (ChevronLeft). */}
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="الأسبوع الماضي"
          >
            <ChevronRight size={15} />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={onToday}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-primary hover:bg-accent transition-colors"
            >
              <RotateCcw size={12} />
              اليوم
            </button>
          )}
          <button
            onClick={onNext}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="الأسبوع التالي"
          >
            <ChevronLeft size={15} />
          </button>
        </div>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-end px-3 py-2.5 font-semibold text-muted-foreground bg-muted/40 w-28 sticky end-0 z-10">
                الطبيب
              </th>
              {weekDates.map((d, i) => {
                const dateStr = dateToStr(d)
                const isToday = dateStr === todayStr
                return (
                  <th
                    key={i}
                    className={`px-2 py-2.5 font-semibold text-center w-[calc((100%-7rem)/7)] ${
                      isToday
                        ? "bg-accent text-primary"
                        : "text-muted-foreground bg-muted/20"
                    }`}
                  >
                    <div>{DAY_LABELS[i]}</div>
                    <div className={`text-[10px] mt-0.5 tabular font-normal ${isToday ? "text-primary/80" : "text-muted-foreground/70"}`}>
                      {formatDayMonth(d)}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {doctors.map((doctor, di) => {
              const isLast = di === doctors.length - 1
              return (
                <tr
                  key={doctor.id}
                  className={`${!isLast ? "border-b border-border" : ""} hover:bg-muted/20`}
                >
                  {/* Doctor name */}
                  <td className="px-3 py-2 font-medium text-foreground bg-muted/10 sticky end-0 z-10">
                    {doctor.displayName}
                  </td>

                  {/* Day cells */}
                  {weekDates.map((d, dayIdx) => {
                    const dateStr = dateToStr(d)
                    const isToday = dateStr === todayStr
                    const weekday = dayIdx  // 0=Sat already
                    const daySchedules = doctor.schedules.filter((s) => s.weekday === weekday)
                    const update = getActiveUpdate(doctor.id, dateStr, doctorUpdates)

                    return (
                      <ScheduleCell
                        key={dayIdx}
                        schedules={daySchedules}
                        update={update}
                        isToday={isToday}
                      />
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Doctor notes */}
      {doctors.some((d) => d.notes) && (
        <div className="border-t border-border px-4 py-3 space-y-1.5">
          {doctors
            .filter((d) => d.notes)
            .map((d) => (
              <div key={d.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info size={12} className="mt-0.5 shrink-0 text-primary/60" />
                <span>
                  <span className="font-medium text-foreground">{d.displayName}:</span>{" "}
                  {d.notes}
                </span>
              </div>
            ))}
        </div>
      )}
    </section>
  )
}

function ScheduleCell({
  schedules,
  update,
  isToday,
}: {
  schedules: Array<{ startTime: string; endTime: string; kind: string }>
  update: DoctorUpdate | null
  isToday: boolean
}) {
  const base = isToday ? "bg-accent/30" : ""

  if (!update && schedules.length === 0) {
    return <td className={`px-2 py-2 text-center ${base}`}>
      <span className="text-muted-foreground/30">—</span>
    </td>
  }

  if (update) {
    const style = UPDATE_CELL_STYLE[update.type] ?? UPDATE_CELL_STYLE.note
    const tooltip = update.note ?? style.label

    if (update.type === "off") {
      return (
        <td className={`px-1.5 py-2 text-center ${style.bg}`} title={tooltip}>
          <span className={`font-semibold ${style.text}`}>{style.label}</span>
        </td>
      )
    }

    if (update.type === "stop") {
      return (
        <td className={`px-1.5 py-2 text-center ${style.bg}`} title={tooltip}>
          <span className={`${style.text} font-medium`}>{style.label}</span>
          {schedules.length > 0 && (
            <div className="text-muted-foreground/60 line-through text-[10px]">
              {formatTime(schedules[0].startTime)}
            </div>
          )}
        </td>
      )
    }

    if (update.type === "hours" && update.segments.length > 0) {
      return (
        <td className={`px-1.5 py-2 text-center ${style.bg}`} title={tooltip}>
          {update.segments.map((seg, i) => (
            <div key={i} className={`${style.text} font-medium leading-tight`}>
              {formatTime(seg.start)}–{formatTime(seg.end)}
            </div>
          ))}
        </td>
      )
    }

    if (update.type === "open_slot") {
      return (
        <td className={`px-1.5 py-2 text-center ${base}`} title="الدور فاضي">
          {schedules.length > 0 && (
            <div className="text-foreground">{formatTime(schedules[0].startTime)}</div>
          )}
          <div className={`text-[10px] font-semibold ${style.text}`}>★ فاضي</div>
        </td>
      )
    }

    if (update.type === "note") {
      return (
        <td className={`px-1.5 py-2 text-center ${base}`} title={update.note ?? ""}>
          {schedules.length > 0 ? (
            <div className="text-foreground">{formatTime(schedules[0].startTime)}</div>
          ) : null}
          <div className={`text-[10px] ${style.text} flex items-center justify-center gap-0.5`}>
            <Info size={10} />
            <span>ملاحظة</span>
          </div>
        </td>
      )
    }
  }

  return (
    <td className={`px-1.5 py-2 text-center ${base}`}>
      {schedules.map((s, i) => (
        <div key={i} className="text-foreground leading-tight">
          {formatTime(s.startTime)}
          {schedules.length === 1 && (
            <span className="text-muted-foreground/60">–{formatTime(s.endTime)}</span>
          )}
        </div>
      ))}
    </td>
  )
}
