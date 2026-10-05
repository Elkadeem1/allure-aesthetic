import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppShell } from "@/components/app/app-shell"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, is_active")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") redirect("/dashboard")

  if (!profile.is_active) {
    await supabase.auth.signOut()
    redirect("/login")
  }

  return (
    <AppShell role="admin" userId={user.id} fullName={profile.full_name}>
      {children}
    </AppShell>
  )
}
