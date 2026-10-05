import { SidebarNav } from "./sidebar-nav"
import { TopBar } from "./top-bar"
import type { AppRole } from "@/lib/types/database.types"

interface AppShellProps {
  role: AppRole
  userId: string
  fullName: string
  subLabel?: string
  children: React.ReactNode
}

export function AppShell({ role, userId, fullName, subLabel, children }: AppShellProps) {
  return (
    /*
      RTL flex: first child = rightmost.
      Sidebar is first → renders on the right.
      Main area is second → renders on the left.
    */
    <div className="flex h-screen overflow-hidden bg-background">
      <SidebarNav role={role} fullName={fullName} subLabel={subLabel} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar userId={userId} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
