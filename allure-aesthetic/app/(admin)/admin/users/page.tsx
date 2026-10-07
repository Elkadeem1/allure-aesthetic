import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { UsersAdmin } from "@/components/admin/users-admin"

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: profiles }, { data: branches }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, branch_id, is_active, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("branches")
      .select("id, name_ar")
      .eq("is_active", true)
      .order("sort"),
  ])

  return (
    <UsersAdmin
      profiles={profiles ?? []}
      branches={(branches ?? []).map((b) => ({ id: b.id, nameAr: b.name_ar }))}
    />
  )
}
