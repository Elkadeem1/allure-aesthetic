"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { MapPin, CreditCard, ListOrdered, AlertTriangle, ChevronDown, ChevronUp, BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cairoToday } from "@/lib/time"
import { addDays } from "@/lib/engine/time"
import { DoctorScheduleTable } from "./doctor-schedule"
import { PriceCatalogue } from "./price-catalogue"
import { SidePanel } from "./side-panel"
import { formatEgp, formatNumber } from "@/lib/format"
import type { BranchData, DoctorUpdate, KbArticle } from "./types"

const CONSULT_LABELS: Record<string, string> = {
  derma:      "كشف جلدية",
  hair:       "كشف شعر",
  derma_hair: "كشف جلد + شعر",
  recons:     "إعادة كشف",
  pulse:      "سعر النبضة",
}

// Pulse is a per-pulse unit price (e.g. "1 ج / نبضة"); other consultations are
// plain amounts.
function formatConsultPrice(kind: string, price: number) {
  return kind === "pulse" ? `${formatNumber(price)} ج / نبضة` : formatEgp(price)
}

const UPDATE_TYPE_LABELS: Record<string, string> = {
  off:       "غايبة",
  stop:      "وقف حجز",
  hours:     "ساعات مختلفة",
  open_slot: "الدور فاضي",
  note:      "ملاحظة",
}

const UPDATE_BANNER_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  off:       { bg: "bg-[var(--status-breach-bg)]",    text: "text-[var(--status-breach)]",   border: "border-[var(--status-breach)]" },
  stop:      { bg: "bg-[var(--status-open-bg)]",      text: "text-[var(--status-open)]",     border: "border-[var(--status-open)]" },
  hours:     { bg: "bg-[var(--status-request-bg)]",   text: "text-[var(--status-request)]",  border: "border-[var(--status-request)]" },
  open_slot: { bg: "bg-[var(--status-confirmed-bg)]", text: "text-[var(--status-confirmed)]", border: "border-[var(--status-confirmed)]" },
  note:      { bg: "bg-[var(--status-notice-bg)]",    text: "text-[var(--status-notice)]",   border: "border-[var(--status-notice)]" },
}

function getActiveBannerUpdates(updates: DoctorUpdate[], todayStr: string) {
  const tomorrow = addDays(todayStr, 1)
  return updates.filter(
    (u) =>
      (u.dateFrom <= todayStr && u.dateTo >= todayStr) ||
      (u.dateFrom <= tomorrow && u.dateTo >= tomorrow)
  )
}

type Props = {
  branches: BranchData[]
}

export function BranchTabs({ branches }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [weekOffset, setWeekOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [sidePanelSlug, setSidePanelSlug] = useState<string | null>(null)
  const [doctorUpdates, setDoctorUpdates] = useState<DoctorUpdate[]>(
    branches.flatMap((b) => b.doctorUpdates)
  )
  const todayStr = cairoToday()

  const branch = branches[activeIdx]

  // Remember the active branch so Ctrl+B / the wizard can preselect it.
  useEffect(() => {
    try {
      localStorage.setItem("allure.lastBranchId", branch.id)
    } catch {
      /* ignore */
    }
  }, [branch.id])

  // Build a combined kb lookup across all branches
  const allKbArticles = branch.kbArticles

  const handleTabChange = useCallback((idx: number) => {
    setActiveIdx(idx)
    setWeekOffset(0)
    setSearch("")
    setSidePanelSlug(null)
  }, [])

  // Realtime subscriptions on doctor_updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("dashboard-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "doctor_updates" },
        (payload) => {
          const row = payload.new as {
            id: string; branch_id: string; doctor_id: string; type: string;
            date_from: string; date_to: string; note: string | null; segments: unknown
          }
          setDoctorUpdates((prev) => [
            ...prev,
            {
              id: row.id,
              doctorId: row.doctor_id,
              type: row.type,
              dateFrom: row.date_from,
              dateTo: row.date_to,
              note: row.note,
              segments: (row.segments as Array<{ start: string; end: string; kind?: string }>) ?? [],
            },
          ])
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "doctor_updates" },
        (payload) => {
          const row = payload.new as {
            id: string; branch_id: string; doctor_id: string; type: string;
            date_from: string; date_to: string; note: string | null; segments: unknown
          }
          setDoctorUpdates((prev) =>
            prev.map((u) =>
              u.id === row.id
                ? {
                    ...u,
                    type: row.type,
                    dateFrom: row.date_from,
                    dateTo: row.date_to,
                    note: row.note,
                    segments: (row.segments as Array<{ start: string; end: string; kind?: string }>) ?? [],
                  }
                : u
            )
          )
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "doctor_updates" },
        (payload) => {
          const id = (payload.old as { id: string }).id
          setDoctorUpdates((prev) => prev.filter((u) => u.id !== id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const branchUpdates = doctorUpdates.filter(
    (u) => branch.doctors.some((d) => d.id === u.doctorId)
  )
  const bannerUpdates = getActiveBannerUpdates(branchUpdates, todayStr)

  const openPanel = useCallback((slug: string) => setSidePanelSlug(slug), [])
  const closePanel = useCallback(() => setSidePanelSlug(null), [])

  const sidePanelArticle = sidePanelSlug
    ? allKbArticles.find((a) => a.slug === sidePanelSlug)
    : null

  return (
    <div className="space-y-4">
      {/* Header: title + primary "new booking" action */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">الفروع</h1>
        <Link
          href={`/dashboard/book?branch=${branch.id}`}
          className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:bg-[#1D4ED8] transition-colors"
        >
          <BookOpen size={15} />
          حجز جديد
          <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono opacity-70 ms-1">
            Ctrl+B
          </kbd>
        </Link>
      </div>

      {/* Branch tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 overflow-x-auto">
        {branches.map((b, i) => (
          <button
            key={b.id}
            onClick={() => handleTabChange(i)}
            className={`shrink-0 text-sm font-medium py-2 px-4 rounded-lg transition-colors ${
              i === activeIdx
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {b.nameAr}
          </button>
        ))}
      </div>

      {/* Branch header */}
      <BranchHeader branch={branch} onChipClick={openPanel} />

      {/* Active updates banner */}
      {bannerUpdates.length > 0 && (
        <UpdatesBanner
          updates={bannerUpdates}
          doctors={branch.doctors}
          todayStr={todayStr}
        />
      )}

      {/* Doctor schedule */}
      <DoctorScheduleTable
        doctors={branch.doctors}
        doctorUpdates={branchUpdates}
        weekOffset={weekOffset}
        todayStr={todayStr}
        onPrev={() => setWeekOffset((o) => o - 1)}
        onNext={() => setWeekOffset((o) => o + 1)}
        onToday={() => setWeekOffset(0)}
      />

      {/* Booking rules */}
      {branch.bookingRules.length > 0 && (
        <BookingRulesList rules={branch.bookingRules} />
      )}

      {/* Price catalogue */}
      {branch.priceCategories.length > 0 && (
        <PriceCatalogue
          categories={branch.priceCategories}
          search={search}
          onSearch={setSearch}
          kbArticles={allKbArticles}
          onKbOpen={openPanel}
        />
      )}

      {/* Side panel */}
      {sidePanelArticle && (
        <SidePanel article={sidePanelArticle} onClose={closePanel} />
      )}
    </div>
  )
}

/* ---------- Branch Header ------------------------------------------- */

function BranchHeader({
  branch,
  onChipClick,
}: {
  branch: BranchData
  onChipClick: (slug: string) => void
}) {
  // Group consultation prices: branch defaults (no doctorId) + per-doctor overrides
  const defaultPrices = branch.consultationPrices.filter((p) => !p.doctorId)
  const overridePrices = branch.consultationPrices.filter((p) => !!p.doctorId)

  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4 space-y-4">
      {/* Address + payment methods row */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        {branch.address && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin size={14} className="shrink-0 text-primary/70" />
            <span>{branch.address}</span>
          </div>
        )}
        {branch.paymentMethods.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <CreditCard size={14} className="shrink-0 text-primary/70" />
            {branch.paymentMethods.map((pm) => (
              <span
                key={pm}
                className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground font-medium"
              >
                {pm}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Consultation prices */}
      {defaultPrices.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">الكشوفات</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {defaultPrices.map((cp) => {
              const override = overridePrices.filter((o) => o.kind === cp.kind)
              return (
                <div
                  key={cp.kind}
                  className="bg-muted/40 rounded-lg px-3 py-2 text-xs"
                >
                  <p className="text-muted-foreground">{CONSULT_LABELS[cp.kind] ?? cp.kind}</p>
                  <p className="font-bold text-foreground tabular mt-0.5">
                    {formatConsultPrice(cp.kind, cp.price)}
                  </p>
                  {override.map((o) => (
                    <p key={o.doctorId} className="text-[10px] text-muted-foreground mt-0.5">
                      {o.doctorName}: {formatConsultPrice(o.kind, o.price)}
                    </p>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Service chips */}
      {branch.services.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {branch.services.map((svc) => (
            <button
              key={svc.id}
              onClick={() => svc.kbSlug && onChipClick(svc.kbSlug)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                svc.kbSlug
                  ? "border-primary/30 bg-accent text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer"
                  : "border-border bg-muted text-foreground cursor-default"
              }`}
            >
              {svc.nameAr}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Updates Banner ------------------------------------------- */

function UpdatesBanner({
  updates,
  doctors,
  todayStr,
}: {
  updates: DoctorUpdate[]
  doctors: BranchData["doctors"]
  todayStr: string
}) {
  const doctorMap = new Map(doctors.map((d) => [d.id, d.displayName]))
  const tomorrow = addDays(todayStr, 1)

  const items = updates.map((u) => {
    const style = UPDATE_BANNER_STYLE[u.type] ?? UPDATE_BANNER_STYLE.note
    const coversToday = u.dateFrom <= todayStr && u.dateTo >= todayStr
    const coversTomorrow = u.dateFrom <= tomorrow && u.dateTo >= tomorrow
    const when = coversToday && coversTomorrow ? "اليوم وغداً" : coversToday ? "اليوم" : "غداً"
    return {
      ...u,
      style,
      when,
      doctorName: u.doctorId ? doctorMap.get(u.doctorId) ?? "—" : "الفرع كله",
    }
  })

  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={14} className="text-[var(--status-open)]" />
        <h2 className="text-xs font-semibold text-foreground">تحديثات نشطة</h2>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((u) => (
          <div
            key={u.id}
            className={`flex items-start gap-3 px-3 py-2 rounded-lg border-s-2 ${u.style.bg} ${u.style.border}`}
          >
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-semibold ${u.style.text}`}>
                {UPDATE_TYPE_LABELS[u.type] ?? u.type}
              </span>
              <span className="text-xs text-muted-foreground mx-2">—</span>
              <span className="text-xs font-medium text-foreground">{u.doctorName}</span>
              {u.note && (
                <span className="text-xs text-muted-foreground ms-1">({u.note})</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{u.when}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Booking Rules -------------------------------------------- */

function BookingRulesList({ rules }: { rules: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? rules : rules.slice(0, 3)
  const hasMore = rules.length > 3

  return (
    <section className="bg-card border border-border rounded-xl px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <ListOrdered size={14} className="text-primary/70" />
        <h2 className="text-sm font-semibold text-foreground">قواعد الحجز</h2>
      </div>
      <ol className="space-y-2">
        {visible.map((rule, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <span className="text-primary font-semibold tabular shrink-0 w-5">{i + 1}.</span>
            <span className="leading-relaxed">{rule}</span>
          </li>
        ))}
      </ol>
      {hasMore && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 mt-3 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp size={13} />
              عرض أقل
            </>
          ) : (
            <>
              <ChevronDown size={13} />
              عرض {rules.length - 3} قاعدة أخرى
            </>
          )}
        </button>
      )}
    </section>
  )
}
