"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Building2,
  Ticket,
  Headphones,
  BookText,
  GaugeCircle,
  CalendarClock,
  Stethoscope,
  Tag,
} from "lucide-react"
import { cn } from "cn"
import { signOut } from "@/app/login/actions"
import { BrandLogo } from "./brand-logo"
import { useDrawers, type DrawerId } from "./drawers"
import type { AppRole } from "@/lib/types/database.types"

interface NavItem {
  label: string
  icon: React.ElementType
  href?: string
  drawer?: DrawerId
  soon?: boolean
}

const BRANCHES: NavItem = { href: "/dashboard", label: "Branches", icon: Building2 }
const SKILLS: NavItem = { drawer: "skills", label: "Soft Skills", icon: Headphones }
const SERVICES: NavItem = { href: "/dashboard/services", label: "Services Guide", icon: BookText }

const AGENT_NAV: NavItem[] = [
  BRANCHES,
  { href: "/dashboard/tickets", label: "My Tickets", icon: Ticket },
  SKILLS,
  SERVICES,
]

const SUPERVISOR_NAV: NavItem[] = [
  BRANCHES,
  { href: "/dashboard/tickets", label: "SLA Board", icon: GaugeCircle },
  SKILLS,
  SERVICES,
]

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Admin", icon: LayoutDashboard },
  BRANCHES,
  { href: "/admin/updates", label: "Updates", icon: CalendarClock },
  { href: "/admin/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/admin/branches", label: "Branch Setup", icon: Building2 },
  { href: "/admin/prices", label: "Prices", icon: Tag },
  { href: "/dashboard/tickets", label: "Tickets", icon: Ticket },
  SKILLS,
  SERVICES,
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings, soon: true },
]

const BRANCH_NAV: NavItem[] = [{ href: "/branch", label: "Innova Tickets", icon: Ticket }]

function navForRole(role: AppRole): NavItem[] {
  if (role === "admin") return ADMIN_NAV
  if (role === "supervisor") return SUPERVISOR_NAV
  if (role === "branch") return BRANCH_NAV
  return AGENT_NAV
}

function roleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    admin: "مدير النظام",
    supervisor: "مشرف",
    agent: "موظف",
    branch: "فرع",
  }
  return labels[role]
}

interface SidebarNavProps {
  role: AppRole
  fullName: string
  subLabel?: string
  logoSrc?: string | null
  logoWordmark: string
}

export function SidebarNav({ role, fullName, subLabel, logoSrc, logoWordmark }: SidebarNavProps) {
  const pathname = usePathname()
  const { open, openId } = useDrawers()
  const nav = navForRole(role)

  const itemClass = (active: boolean, soon?: boolean) =>
    cn(
      "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
      active
        ? "bg-accent text-primary font-semibold"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
      soon && "pointer-events-none opacity-40"
    )

  const ActiveBar = () => (
    <span aria-hidden className="absolute inset-y-1.5 start-0 w-[3px] rounded-e-full bg-primary" />
  )

  return (
    <aside className="flex flex-col h-full w-56 shrink-0 bg-sidebar border-s border-sidebar-border">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 h-16 shrink-0 border-b border-sidebar-border">
        <BrandLogo
          src={logoSrc}
          alt={logoWordmark}
          wordmark={logoWordmark}
          imgClassName="h-7 w-auto max-w-[128px] object-contain object-right"
          wordmarkClassName="text-lg"
        />
        {subLabel && (
          <span className="text-[11px] text-muted-foreground truncate border-s border-border ps-2.5 leading-tight">
            {subLabel}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          if (item.drawer) {
            const active = openId === item.drawer
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => open(item.drawer!)}
                className={cn(itemClass(active), "w-full text-start")}
              >
                {active && <ActiveBar />}
                <item.icon size={16} className="shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            )
          }
          const href = item.href!
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={item.soon ? "#" : href}
              aria-disabled={item.soon}
              className={itemClass(active, item.soon)}
            >
              {active && <ActiveBar />}
              <item.icon size={16} className="shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.soon && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                  قريبًا
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User + logout */}
      <div className="p-2 border-t border-sidebar-border space-y-0.5">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 select-none">
            {fullName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{fullName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{roleLabel(role)}</p>
          </div>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut size={14} className="shrink-0" />
            <span>تسجيل خروج</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
