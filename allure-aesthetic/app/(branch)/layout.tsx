import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppShell } from "@/components/app/app-shell"

export default async function BranchLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, is_active, branch_id, branches(name_ar, logo_url)")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "branch") redirect("/dashboard")

  if (!profile.is_active) {
    await supabase.auth.signOut()
    redirect("/login")
  }

  const branch = (profile as { branches?: { name_ar?: string; logo_url?: string | null } }).branches

  return (
    <AppShell
      role="branch"
      userId={user.id}
      fullName={profile.full_name}
      subLabel={branch?.name_ar}
      logoSrc={branch?.logo_url ?? "/brand/innova-logo.svg"}
      logoWordmark="innova"
    >
      {children}
    </AppShell>
  )
}
