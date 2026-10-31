import { SidebarNav } from "./sidebar-nav"
import { TopBar } from "./top-bar"
import { DrawerProvider } from "./drawers"
import { FloatingActions } from "./floating-actions"
import type { AppRole } from "@/lib/types/database.types"

interface AppShellProps {
  role: AppRole
  userId: string
  fullName: string
  subLabel?: string
  logoSrc?: string | null
  logoWordmark: string
  children: React.ReactNode
}

export function AppShell({
  role,
  userId,
  fullName,
  subLabel,
  logoSrc,
  logoWordmark,
  children,
}: AppShellProps) {
  // The Innova branch account only works tickets — no booking tools for it.
  const canBook = role !== "branch"

  return (
    <DrawerProvider canBook={canBook}>
      {/*
        RTL flex: first child = rightmost.
        Sidebar is first → renders on the right. Main area is second → left.
      */}
      <div className="flex h-screen overflow-hidden bg-background">
        <SidebarNav
          role={role}
          fullName={fullName}
          subLabel={subLabel}
          logoSrc={logoSrc}
          logoWordmark={logoWordmark}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar userId={userId} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>

      {canBook && <FloatingActions />}
    </DrawerProvider>
  )
}
