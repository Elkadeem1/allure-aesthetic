"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Users,
  Plus,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Copy,
  Wand2,
  Search,
  Power,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "cn"
import {
  createUserAction,
  updateUserAction,
  setUserActiveAction,
  resetPasswordAction,
} from "@/app/(admin)/admin/users/actions"
import type { AppRole } from "@/lib/types/database.types"

export type UserRow = {
  id: string
  fullName: string
  email: string
  role: AppRole
  branchId: string | null
  isActive: boolean
  createdAt: string
}

export type UserBranch = { id: string; nameAr: string; hasTickets: boolean }

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير النظام",
  supervisor: "مشرف",
  agent: "موظف",
  branch: "فرع",
}

const ROLE_CHIP: Record<AppRole, { bg: string; text: string }> = {
  admin: { bg: "var(--status-request-bg)", text: "var(--status-request)" },
  supervisor: { bg: "var(--status-open-bg)", text: "var(--status-open)" },
  agent: { bg: "var(--status-notice-bg)", text: "var(--status-notice)" },
  branch: { bg: "var(--status-confirmed-bg)", text: "var(--status-confirmed)" },
}

const SELECT_CLS = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%"
  const arr = new Uint32Array(14)
  crypto.getRandomValues(arr)
  return Array.from(arr, (x) => chars[x % chars.length]).join("")
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("اتنسخت كلمة المرور")
  } catch {
    toast.error("مقدرناش ننسخ — انسخها يدوي.")
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function UsersAdmin({
  users,
  branches,
  currentUserId,
}: {
  users: UserRow[]
  branches: UserBranch[]
  currentUserId: string
}) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [query, setQuery] = useState("")

  const ticketBranches = branches.filter((b) => b.hasTickets)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false
      if (statusFilter === "active" && !u.isActive) return false
      if (statusFilter === "inactive" && u.isActive) return false
      if (q && !`${u.fullName} ${u.email}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [users, roleFilter, statusFilter, query])

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">Users</h1>
          <span className="text-sm text-muted-foreground">({users.length})</span>
        </div>
        <Button onClick={() => setShowCreate((s) => !s)} variant={showCreate ? "secondary" : "default"}>
          <Plus size={15} className="me-1" /> حساب جديد
        </Button>
      </div>

      {showCreate && (
        <CreateUserForm
          branches={ticketBranches}
          onDone={() => {
            setShowCreate(false)
            router.refresh()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 h-9 flex-1 min-w-[180px]">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالاسم أو الإيميل…"
            className="flex-1 text-sm bg-transparent outline-none text-foreground"
            dir="rtl"
          />
        </div>
        <select className={cn(SELECT_CLS, "w-auto")} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">كل الأدوار</option>
          {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select
          className={cn(SELECT_CLS, "w-auto")}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">الكل</option>
          <option value="active">فعال</option>
          <option value="inactive">معطل</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card rounded-xl border border-border text-muted-foreground text-sm">
          <Users size={24} className="mb-2 opacity-40" />
          مفيش مستخدمين مطابقين.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <UserRowCard
              key={u.id}
              user={u}
              branches={ticketBranches}
              branchName={branches.find((b) => b.id === u.branchId)?.nameAr}
              isSelf={u.id === currentUserId}
              expanded={expandedId === u.id}
              onToggle={() => setExpandedId(expandedId === u.id ? null : u.id)}
              onChanged={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- create ---------------- */

function CreateUserForm({
  branches,
  onDone,
  onCancel,
}: {
  branches: UserBranch[]
  onDone: () => void
  onCancel: () => void
}) {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<AppRole>("agent")
  const [branchId, setBranchId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    const res = await createUserAction({
      email,
      password,
      fullName,
      role,
      branchId: role === "branch" ? branchId : null,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("اتعمل الحساب")
      onDone()
    } else toast.error(res.error)
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h2 className="text-sm font-bold text-foreground">حساب جديد</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>الاسم الكامل</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>البريد الإلكتروني</Label>
          <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>كلمة المرور</Label>
        <div className="flex gap-1.5">
          <Input dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="button" variant="secondary" size="icon" title="توليد" onClick={() => setPassword(genPassword())}>
            <Wand2 size={15} />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            title="نسخ"
            disabled={!password}
            onClick={() => copyText(password)}
          >
            <Copy size={15} />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>الدور</Label>
          <select className={SELECT_CLS} value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
            <option value="admin">مدير النظام</option>
            <option value="supervisor">مشرف</option>
            <option value="agent">موظف</option>
            <option value="branch">فرع</option>
          </select>
        </div>
        {role === "branch" && (
          <div className="space-y-1">
            <Label>الفرع</Label>
            <select className={SELECT_CLS} value={branchId ?? ""} onChange={(e) => setBranchId(e.target.value || null)}>
              <option value="">اختار الفرع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameAr}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <Button onClick={submit} loading={busy}>
          إنشاء
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </div>
  )
}

/* ---------------- row + edit ---------------- */

function UserRowCard({
  user,
  branches,
  branchName,
  isSelf,
  expanded,
  onToggle,
  onChanged,
}: {
  user: UserRow
  branches: UserBranch[]
  branchName?: string
  isSelf: boolean
  expanded: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [fullName, setFullName] = useState(user.fullName)
  const [role, setRole] = useState<AppRole>(user.role)
  const [branchId, setBranchId] = useState<string | null>(user.branchId)
  const [busy, setBusy] = useState(false)
  const [newPw, setNewPw] = useState("")
  const [pwBusy, setPwBusy] = useState(false)
  const chip = ROLE_CHIP[user.role]

  const save = async () => {
    setBusy(true)
    const res = await updateUserAction({
      userId: user.id,
      fullName,
      role,
      branchId: role === "branch" ? branchId : null,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("اتحدّث")
      onChanged()
    } else toast.error(res.error)
  }

  const toggleActive = async () => {
    setBusy(true)
    const res = await setUserActiveAction({ userId: user.id, isActive: !user.isActive })
    setBusy(false)
    if (res.ok) {
      toast.success(user.isActive ? "اتوقف الحساب" : "اترجّع الحساب")
      onChanged()
    } else toast.error(res.error)
  }

  const resetPw = async () => {
    if (!newPw) return
    setPwBusy(true)
    const res = await resetPasswordAction({ userId: user.id, newPassword: newPw })
    setPwBusy(false)
    if (res.ok) {
      toast.success("اتغيّرت كلمة المرور")
      setNewPw("")
    } else toast.error(res.error)
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-start">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent text-primary text-xs font-bold shrink-0 select-none">
          {user.fullName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{user.fullName}</p>
          <p className="text-xs text-muted-foreground truncate" dir="ltr">
            {user.email}
          </p>
        </div>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: chip.bg, color: chip.text }}
        >
          {ROLE_LABELS[user.role]}
          {branchName ? ` · ${branchName}` : ""}
        </span>
        {!user.isActive && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--status-breach-bg)] text-[var(--status-breach)] shrink-0">
            معطل
          </span>
        )}
        {expanded ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>الاسم</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>الدور</Label>
              <select
                className={SELECT_CLS}
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                disabled={isSelf}
              >
                <option value="admin">مدير النظام</option>
                <option value="supervisor">مشرف</option>
                <option value="agent">موظف</option>
                <option value="branch">فرع</option>
              </select>
            </div>
          </div>
          {role === "branch" && (
            <div className="space-y-1">
              <Label>الفرع</Label>
              <select className={SELECT_CLS} value={branchId ?? ""} onChange={(e) => setBranchId(e.target.value || null)}>
                <option value="">اختار الفرع</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nameAr}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">اتعمل: {formatDate(user.createdAt)}</p>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={save} loading={busy}>
              <Save size={14} className="me-1" /> حفظ
            </Button>
            {!isSelf && (
              <Button size="sm" variant={user.isActive ? "danger" : "secondary"} onClick={toggleActive} loading={busy}>
                <Power size={14} className="me-1" />
                {user.isActive ? "إيقاف الحساب" : "تفعيل الحساب"}
              </Button>
            )}
          </div>

          {/* Reset password */}
          <div className="space-y-1 pt-1 border-t border-border/60">
            <Label className="flex items-center gap-1.5 pt-2">
              <KeyRound size={13} /> كلمة مرور جديدة
            </Label>
            <div className="flex gap-1.5">
              <Input dir="ltr" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="•••••••" />
              <Button type="button" variant="secondary" size="icon" title="توليد" onClick={() => setNewPw(genPassword())}>
                <Wand2 size={15} />
              </Button>
              <Button type="button" variant="secondary" size="icon" title="نسخ" disabled={!newPw} onClick={() => copyText(newPw)}>
                <Copy size={15} />
              </Button>
              <Button size="sm" onClick={resetPw} loading={pwBusy} disabled={!newPw}>
                تغيير
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
