"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Settings,
  LogOut,
  Building2,
  Ticket,
  AlertTriangle,
} from "lucide-react"
import { cn } from "cn"
import { signOut } from "@/app/login/actions"
import type { AppRole } from "@/lib/types/database.types"

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  soon?: boolean
}

const AGENT_NAV: NavItem[] = [
  { href: "/dashboard",         label: "الفروع",   icon: Building2 },
  { href: "/dashboard/book",    label: "حجز جديد", icon: BookOpen },
  { href: "/dashboard/tickets", label: "تيكتاتي",  icon: Ticket },
]

const SUPERVISOR_NAV: NavItem[] = [
  { href: "/dashboard",         label: "الفروع",     icon: Building2 },
  { href: "/dashboard/book",    label: "حجز جديد",   icon: BookOpen },
  { href: "/dashboard/tickets", label: "تيكتاتي",    icon: Ticket },
  { href: "/dashboard/sla",     label: "متابعة SLA", icon: AlertTriangle },
]

const ADMIN_NAV: NavItem[] = [
  { href: "/admin",     label: "إدارة",      icon: LayoutDashboard },
  { href: "/dashboard", label: "الفروع",     icon: Building2 },
  { href: "/dashboard/book",    label: "حجز جديد", icon: BookOpen },
  { href: "/dashboard/tickets", label: "التيكتات", icon: Ticket },
  { href: "/dashboard/sla",     label: "متابعة SLA", icon: AlertTriangle },
  { href: "/admin/users",    label: "المستخدمين", icon: Users,    soon: true },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings, soon: true },
]

const BRANCH_NAV: NavItem[] = [
  { href: "/branch",        label: "تيكتاتنا", icon: Ticket },
  { href: "/branch/manage", label: "إدارة الفرع", icon: Settings },
]

function navForRole(role: AppRole): NavItem[] {
  if (role === "admin") return ADMIN_NAV
  if (role === "supervisor") return SUPERVISOR_NAV
  if (role === "branch") return BRANCH_NAV
  return AGENT_NAV
}

function roleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    admin:      "مدير النظام",
    supervisor: "مشرف",
    agent:      "موظف",
    branch:     "فرع",
  }
  return labels[role]
}

interface SidebarNavProps {
  role: AppRole
  fullName: string
  subLabel?: string
}

export function SidebarNav({ role, fullName, subLabel }: SidebarNavProps) {
  const pathname = usePathname()
  const nav = navForRole(role)

  return (
    <aside className="flex flex-col h-full w-56 shrink-0 bg-sidebar border-s border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-black text-sm shrink-0 select-none">
          A
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight text-foreground">Allure</p>
          <p className="text-[11px] text-muted-foreground truncate leading-tight">
            {subLabel ?? "مركز الاتصالات"}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          // Exact match for the dashboard root so it doesn't stay lit on /dashboard/book etc.
          const active =
            item.href === "/dashboard" || item.href === "/branch"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.soon ? "#" : item.href}
              aria-disabled={item.soon}
              className={cn(
                "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                item.soon && "pointer-events-none opacity-40"
              )}
            >
              {active && (
                /* straight 3px bar on the inline-start (right in RTL) edge */
                <span
                  aria-hidden
                  className="absolute inset-y-1.5 start-0 w-[3px] rounded-e-full bg-primary"
                />
              )}
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

      {/* User card + logout */}
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
