import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { UsersAdmin, type UserRow, type UserBranch } from "@/components/admin/users-admin"

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: profiles }, { data: branches }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, branch_id, is_active, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("branches").select("id, name_ar, has_tickets").eq("is_active", true).order("sort"),
  ])

  // Emails live in auth.users — fetch them with the service-role client.
  const admin = createAdminClient()
  const emailById = new Map<string, string>()
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  for (const u of authList?.users ?? []) if (u.email) emailById.set(u.id, u.email)

  const users: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: emailById.get(p.id) ?? "—",
    role: p.role,
    branchId: p.branch_id,
    isActive: p.is_active,
    createdAt: p.created_at,
  }))

  const branchList: UserBranch[] = (branches ?? []).map((b) => ({
    id: b.id,
    nameAr: b.name_ar,
    hasTickets: b.has_tickets,
  }))

  return <UsersAdmin users={users} branches={branchList} currentUserId={user.id} />
}
