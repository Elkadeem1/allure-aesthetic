"use client"

import { X } from "lucide-react"
import { useEffect } from "react"
import type { KbArticle } from "./types"

const SECTION_LABELS: Record<string, string> = {
  explain:      "نظرة عامة",
  indications:  "الحالات المناسبة",
  before:       "قبل الجلسة",
  after:        "بعد الجلسة",
  contra:       "موانع الاستخدام",
  neverSay:     "لا تقل للعميل",
}

function renderBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return typeof body === "string" ? (
      <p className="text-sm text-foreground leading-relaxed">{body}</p>
    ) : null
  }

  if (Array.isArray(body)) {
    return (
      <ul className="space-y-1">
        {body.map((item, i) => (
          <li key={i} className="text-sm text-foreground flex gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>{String(item)}</span>
          </li>
        ))}
      </ul>
    )
  }

  const obj = body as Record<string, unknown>

  // Known keys in order
  const orderedKeys = Object.keys(SECTION_LABELS).filter((k) => k in obj)
  const otherKeys = Object.keys(obj).filter((k) => !Object.keys(SECTION_LABELS).includes(k))
  const allKeys = [...orderedKeys, ...otherKeys]

  return (
    <div className="space-y-4">
      {allKeys.map((key) => {
        const val = obj[key]
        if (!val) return null
        const label = SECTION_LABELS[key] ?? key
        return (
          <div key={key}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              {label}
            </h4>
            {typeof val === "string" ? (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{val}</p>
            ) : Array.isArray(val) ? (
              <ul className="space-y-1">
                {val.map((item, i) => (
                  <li key={i} className="text-sm text-foreground flex gap-2">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    <span>{String(item)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground">{JSON.stringify(val)}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

type Props = {
  article: KbArticle
  onClose: () => void
}

export function SidePanel({ article, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel — slides in from the left (content side in RTL) */}
      <div
        className="fixed top-0 start-0 bottom-0 z-50 w-full max-w-sm bg-card shadow-xl border-e border-border flex flex-col"
        dir="rtl"
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-foreground">{article.title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {renderBody(article.body)}
        </div>
      </div>
    </>
  )
}
