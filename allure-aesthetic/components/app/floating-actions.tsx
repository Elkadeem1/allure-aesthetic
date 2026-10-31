"use client"

import { Plus, HelpCircle, MessageSquareText } from "lucide-react"
import { cn } from "cn"
import { useDrawers, type DrawerId } from "./drawers"

type Action = {
  id: DrawerId
  label: string
  icon: React.ElementType
  primary?: boolean
}

const ACTIONS: Action[] = [
  { id: "booking", label: "حجز جديد", icon: Plus, primary: true },
  { id: "recommend", label: "مين يرشّح إيه", icon: HelpCircle },
  { id: "chat", label: "ردود الشات", icon: MessageSquareText },
]

/**
 * A fixed vertical stack of round action buttons at the bottom-left (inline-end
 * in RTL). Each opens its drawer; hover reveals the name.
 */
export function FloatingActions() {
  const { open, openId } = useDrawers()

  return (
    <div className="fixed bottom-5 end-5 z-50 flex flex-col-reverse gap-3">
      {ACTIONS.map((a) => {
        const active = openId === a.id
        return (
          <div key={a.id} className="group relative flex items-center">
            {/* tooltip (appears to the inline-start / right) */}
            <span
              className="pointer-events-none absolute end-full me-3 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1 text-xs font-medium text-background opacity-0 translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0"
              role="tooltip"
            >
              {a.label}
            </span>
            <button
              type="button"
              onClick={() => open(a.id)}
              aria-label={a.label}
              className={cn(
                "flex items-center justify-center rounded-full shadow-lg transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2",
                a.primary ? "size-14" : "size-12",
                a.primary
                  ? "bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
                  : active
                    ? "bg-accent text-primary border border-primary/30"
                    : "bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-muted"
              )}
            >
              <a.icon size={a.primary ? 24 : 19} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
