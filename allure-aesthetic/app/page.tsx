import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const roleHome: Record<string, string> = {
    admin: "/admin",
    supervisor: "/dashboard",
    agent: "/dashboard",
    branch: "/branch",
  }

  redirect(roleHome[profile?.role ?? ""] ?? "/dashboard")
}
