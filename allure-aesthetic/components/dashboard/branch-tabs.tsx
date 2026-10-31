"use client"

import { useState, useEffect, useCallback } from "react"
import { MapPin, CreditCard, Megaphone } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cairoToday } from "@/lib/time"
import { BrandLogo } from "@/components/app/brand-logo"
import { TodayStrip, BranchSchedule } from "./doctor-schedule"
import { PriceCatalogue } from "./price-catalogue"
import { SidePanel } from "./side-panel"
import { upsList, type BannerRow } from "./schedule-utils"
import { formatEgp, formatNumber } from "@/lib/format"
import type { BranchData, ConsultRow, DoctorUpdate } from "./types"

function formatConsultPrice(row: ConsultRow): string {
  if (row.priceText) return row.priceText
  if (row.price === null) return "—"
  return formatEgp(row.price)
}

// Dot colour per update type for the banner.
const BANNER_DOT: Record<string, string> = {
  off: "var(--status-breach)",
  full: "var(--status-breach)",
  stop: "var(--status-open)",
  booking_cutoff: "var(--status-open)",
  laser_stop: "var(--status-open)",
  hours: "var(--status-request)",
  open_slot: "var(--status-confirmed)",
  force_open: "var(--status-confirmed)",
  note: "var(--status-notice)",
}

type Props = {
  branches: BranchData[]
  initialCat?: string
}

export function BranchTabs({ branches, initialCat }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [search, setSearch] = useState("")
  const [sidePanelSlug, setSidePanelSlug] = useState<string | null>(null)
  const [doctorUpdates, setDoctorUpdates] = useState<DoctorUpdate[]>(
    branches.flatMap((b) => b.doctorUpdates)
  )
  const todayStr = cairoToday()

  const branch = branches[activeIdx]
  const allKbArticles = branch.kbArticles

  useEffect(() => {
    try {
      localStorage.setItem("allure.lastBranchId", branch.id)
    } catch {
      /* ignore */
    }
  }, [branch.id])

  const handleTabChange = useCallback((idx: number) => {
    setActiveIdx(idx)
    setSearch("")
    setSidePanelSlug(null)
  }, [])

  // Realtime: keep doctor_updates fresh (banner + schedule cells).
  useEffect(() => {
    const supabase = createClient()
    const mapRow = (row: {
      id: string; doctor_id: string | null; type: string; date_from: string;
      date_to: string; at_time: string | null; weekdays: number[] | null; note: string | null; segments: unknown
    }): DoctorUpdate => ({
      id: row.id,
      doctorId: row.doctor_id,
      type: row.type,
      dateFrom: row.date_from,
      dateTo: row.date_to,
      atTime: row.at_time,
      weekdays: row.weekdays ?? [],
      note: row.note,
      segments: (row.segments as Array<{ start: string; end: string; kind?: string }>) ?? [],
    })
    const channel = supabase
      .channel("dashboard-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "doctor_updates" }, (p) =>
        setDoctorUpdates((prev) => [...prev, mapRow(p.new as Parameters<typeof mapRow>[0])])
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "doctor_updates" }, (p) => {
        const row = mapRow(p.new as Parameters<typeof mapRow>[0])
        setDoctorUpdates((prev) => prev.map((u) => (u.id === row.id ? row : u)))
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "doctor_updates" }, (p) => {
        const id = (p.old as { id: string }).id
        setDoctorUpdates((prev) => prev.filter((u) => u.id !== id))
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // This branch's updates (per-doctor + branch-wide incl. full).
  const branchUpdates = doctorUpdates.filter(
    (u) => branch.doctors.some((d) => d.id === u.doctorId) || branch.doctorUpdates.some((bu) => bu.id === u.id)
  )
  const doctorName = useCallback(
    (id: string | null) => (id ? branch.doctors.find((d) => d.id === id)?.displayName ?? "—" : "الفرع كله"),
    [branch.doctors]
  )
  const bannerRows = upsList(branchUpdates, doctorName, todayStr, 7)

  const openPanel = useCallback((slug: string) => setSidePanelSlug(slug), [])
  const closePanel = useCallback(() => setSidePanelSlug(null), [])
  const sidePanelArticle = sidePanelSlug ? allKbArticles.find((a) => a.slug === sidePanelSlug) : null

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Branches</h1>

      {/* Branch tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 overflow-x-auto">
        {branches.map((b, i) => (
          <button
            key={b.id}
            onClick={() => handleTabChange(i)}
            className={`shrink-0 inline-flex items-center gap-1.5 text-sm font-medium py-2 px-4 rounded-lg transition-colors ${
              i === activeIdx
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {b.logoUrl && (
              <BrandLogo
                src={b.logoUrl}
                alt={b.nameAr}
                wordmark=""
                imgClassName={`h-4 w-auto max-w-[56px] object-contain ${i === activeIdx ? "brightness-0 invert" : ""}`}
              />
            )}
            {b.nameAr}
          </button>
        ))}
      </div>

      <BranchHeader branch={branch} onChipClick={openPanel} />

      {/* Today / tomorrow */}
      <TodayStrip doctors={branch.doctors} updates={branchUpdates} todayStr={todayStr} />

      {/* Updates — next 7 days */}
      {bannerRows.length > 0 && <UpdatesBanner rows={bannerRows} />}

      {/* Schedule: week table / day timeline */}
      <BranchSchedule
        branch={{ doctors: branch.doctors, rooms: branch.rooms.map((r) => ({ id: r.id, title: r.title })) }}
        todayStr={todayStr}
        updates={branchUpdates}
      />

      {branch.priceCategories.length > 0 && (
        <PriceCatalogue
          categories={branch.priceCategories}
          laserTable={branch.laserTable}
          initialOpen={initialCat}
          search={search}
          onSearch={setSearch}
          kbArticles={allKbArticles}
          onKbOpen={openPanel}
        />
      )}

      {sidePanelArticle && <SidePanel article={sidePanelArticle} onClose={closePanel} />}
    </div>
  )
}

/* ---------- Updates banner (next 7 days) ---------- */

function UpdatesBanner({ rows }: { rows: BannerRow[] }) {
  const shown = rows.slice(0, 6)
  const extra = rows.length - shown.length
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Megaphone size={14} className="text-primary" />
        <h2 className="text-xs font-semibold text-foreground">Updates الأسبوع الجاي</h2>
      </div>
      <div className="flex flex-col gap-1">
        {shown.map((r) => (
          <div key={r.id} className="flex items-start gap-2 text-xs text-foreground">
            <span className="inline-block size-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: BANNER_DOT[r.type] ?? "var(--status-notice)" }} />
            <span>{r.text}</span>
          </div>
        ))}
        {extra > 0 && <div className="text-xs text-muted-foreground ps-3.5">… و{formatNumber(extra)} كمان</div>}
      </div>
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
  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4 space-y-4">
      {branch.logoUrl && (
        <div className="flex items-center gap-3 border-b border-border pb-3 -mt-0.5">
          <BrandLogo
            src={branch.logoUrl}
            alt={branch.nameAr}
            wordmark={branch.nameAr}
            imgClassName="h-8 w-auto max-w-[150px] object-contain object-right"
          />
        </div>
      )}
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
              <span key={pm} className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground font-medium">
                {pm}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Consultations + pulse */}
      {(branch.consultations.length > 0 || branch.pulseFemale != null || branch.pulseMale != null) && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">الكشوفات والنبضة</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {branch.consultations.map((c) => (
              <div key={c.code} className="bg-muted/40 rounded-lg px-3 py-2 text-xs">
                <p className="text-muted-foreground leading-snug">{c.label}</p>
                <p className="font-bold text-foreground tabular mt-0.5">{formatConsultPrice(c)}</p>
              </div>
            ))}
            {branch.pulseFemale != null && (
              <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs">
                <p className="text-muted-foreground">سعر النبضة — سيدات</p>
                <p className="font-bold text-foreground tabular mt-0.5">{formatNumber(branch.pulseFemale)} ج / نبضة</p>
              </div>
            )}
            {branch.pulseMale != null && (
              <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs">
                <p className="text-muted-foreground">سعر النبضة — رجال</p>
                <p className="font-bold text-foreground tabular mt-0.5">{formatNumber(branch.pulseMale)} ج / نبضة</p>
              </div>
            )}
          </div>
        </div>
      )}

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
