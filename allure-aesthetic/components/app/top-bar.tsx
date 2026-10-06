import { Search } from "lucide-react"
import { CairoClock } from "./cairo-clock"
import { NotificationBell } from "./notification-bell"
import type { AppRole } from "@/lib/types/database.types"

export function TopBar({ userId, role }: { userId: string; role: AppRole }) {
  return (
    <header className="h-13 shrink-0 flex items-center gap-3 px-5 bg-card border-b border-border">
      {/* Clock — on the end (left in RTL since flex row reverses) */}
      <div className="flex items-center gap-3 ms-auto">
        <NotificationBell userId={userId} role={role} />

        <div className="w-px h-5 bg-border" />

        {/* Search placeholder */}
        <button
          className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-background text-muted-foreground text-sm transition-colors hover:border-border/80 hover:bg-muted"
          aria-label="بحث"
        >
          <Search size={14} />
          <span>بحث...</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono opacity-60">
            ⌃K
          </kbd>
        </button>

        <div className="w-px h-5 bg-border" />
        <CairoClock />
      </div>
    </header>
  )
}
