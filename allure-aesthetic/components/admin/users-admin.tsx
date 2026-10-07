"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Users, Plus, ChevronDown, ChevronUp, KeyRound } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "cn"
import {
  createUserAction,
  updateUserAction,
  resetPasswordAction,
} from "@/app/(admin)/admin/actions"
import type { AppRole } from "@/lib/types/database.types"

type Profile = {
  id: string
  full_name: string
  role: AppRole
  branch_id: string | null
  is_active: boolean
  created_at: string
}

interface UsersAdminProps {
  profiles: Profile[]
  branches: Array<{ id: string; nameAr: string }>
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير النظام",
  supervisor: "مشرف",
  agent: "موظف",
  branch: "فرع",
}

export function UsersAdmin({ profiles: initial, branches }: UsersAdminProps) {
  const [profiles, setProfiles] = useState(initial)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resetId, setResetId] = useState<string | null>(null)

  // Create form
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState<AppRole>("agent")
  const [branchId, setBranchId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const resetForm = () => {
    setEmail("")
    setPassword("")
    setFullName("")
    setRole("agent")
    setBranchId(null)
    setShowCreate(false)
  }

  const handleCreate = async () => {
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
      toast.success("تم إنشاء الحساب")
      resetForm()
      window.location.reload()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">المستخدمين</h1>
          <Badge variant="secondary" className="text-xs">{profiles.length}</Badge>
        </div>
        <Button
          variant={showCreate ? "secondary" : "default"}
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus size={14} className="me-1" />
          حساب جديد
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">حساب جديد</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>الاسم</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>البريد الإلكتروني</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>كلمة المرور</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>الدور</Label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AppRole)}
                  className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm"
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
                <select
                  value={branchId ?? ""}
                  onChange={(e) => setBranchId(e.target.value || null)}
                  className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">اختر الفرع</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.nameAr}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleCreate} loading={busy}>إنشاء</Button>
              <Button size="sm" variant="secondary" onClick={resetForm}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {profiles.map((p) => (
          <UserRow
            key={p.id}
            profile={p}
            branches={branches}
            expanded={expandedId === p.id}
            onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
            showReset={resetId === p.id}
            onToggleReset={() => setResetId(resetId === p.id ? null : p.id)}
            onUpdated={(updated) => {
              setProfiles((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
            }}
          />
        ))}
      </div>
    </div>
  )
}

function UserRow({
  profile,
  branches,
  expanded,
  onToggle,
  showReset,
  onToggleReset,
  onUpdated,
}: {
  profile: Profile
  branches: Array<{ id: string; nameAr: string }>
  expanded: boolean
  onToggle: () => void
  showReset: boolean
  onToggleReset: () => void
  onUpdated: (p: Profile) => void
}) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [role, setRole] = useState<AppRole>(profile.role)
  const [branchId, setBranchId] = useState<string | null>(profile.branch_id)
  const [isActive, setIsActive] = useState(profile.is_active)
  const [busy, setBusy] = useState(false)
  const [newPw, setNewPw] = useState("")
  const [pwBusy, setPwBusy] = useState(false)

  const branchName = branches.find((b) => b.id === profile.branch_id)?.nameAr

  const save = async () => {
    setBusy(true)
    const res = await updateUserAction({
      userId: profile.id,
      fullName,
      role,
      branchId: role === "branch" ? branchId : null,
      isActive,
    })
    setBusy(false)
    if (res.ok) {
      toast.success("تم التحديث")
      onUpdated({ ...profile, full_name: fullName, role, branch_id: role === "branch" ? branchId : null, is_active: isActive })
    } else {
      toast.error(res.error)
    }
  }

  const handleResetPw = async () => {
    setPwBusy(true)
    const res = await resetPasswordAction({ userId: profile.id, newPassword: newPw })
    setPwBusy(false)
    if (res.ok) {
      toast.success("تم تغيير كلمة المرور")
      setNewPw("")
      onToggleReset()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-start"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
          {profile.full_name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{profile.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {ROLE_LABELS[profile.role]}
            {branchName ? ` — ${branchName}` : ""}
          </p>
        </div>
        <Badge variant={profile.is_active ? "default" : "destructive"} className="text-[10px]">
          {profile.is_active ? "فعال" : "معطل"}
        </Badge>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>الاسم</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>الدور</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm"
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
              <select
                value={branchId ?? ""}
                onChange={(e) => setBranchId(e.target.value || null)}
                className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">اختر الفرع</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.nameAr}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              <span>حساب فعال</span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} loading={busy}>حفظ</Button>
            <Button size="sm" variant="secondary" onClick={onToggleReset}>
              <KeyRound size={12} className="me-1" />
              تغيير كلمة المرور
            </Button>
          </div>

          {showReset && (
            <div className="flex items-center gap-2 pt-1">
              <Input
                type="password"
                placeholder="كلمة المرور الجديدة"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-48"
              />
              <Button size="sm" onClick={handleResetPw} loading={pwBusy}>تغيير</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
