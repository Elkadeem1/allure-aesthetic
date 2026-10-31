"use client"

import { useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "cn"

type Side = "start" | "end" // start = right in RTL, end = left in RTL

/**
 * One reusable slide-in drawer. Slides from `side`, ~440px wide (full width on
 * small screens), with an overlay, Escape + overlay-click to close, a focus
 * trap, and a scrollable body. Only render one at a time.
 */
export function Drawer({
  open,
  onClose,
  side = "start",
  title,
  wide = false,
  children,
}: {
  open: boolean
  onClose: () => void
  side?: Side
  title: string
  wide?: boolean
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  // Lock body scroll + remember the element to restore focus to.
  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    // focus the first focusable element in the panel
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      first?.focus()
    }, 40)
    return () => {
      document.body.style.overflow = prev
      window.clearTimeout(t)
      restoreRef.current?.focus?.()
    }
  }, [open])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== "Tab") return
      // focus trap
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!nodes || nodes.length === 0) return
      const list = Array.from(nodes).filter((n) => n.offsetParent !== null)
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      const active = document.activeElement as HTMLElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [onClose]
  )

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-[rgba(43,35,32,0.38)] animate-overlay"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        onKeyDown={onKeyDown}
        className={cn(
          "absolute top-0 bottom-0 flex flex-col bg-background shadow-xl",
          wide ? "w-full sm:w-[640px] max-w-[96vw]" : "w-full sm:w-[440px] max-w-[94vw]",
          side === "end"
            ? "start-auto end-0 border-s border-border animate-drawer-end"
            : "end-auto start-0 border-e border-border animate-drawer-start"
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 h-14 shrink-0 border-b border-border bg-card">
          <h2 className="text-base font-bold text-foreground truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:scale-95"
          >
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>,
    document.body
  )
}
