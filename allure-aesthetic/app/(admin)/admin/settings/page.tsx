import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SettingsAdmin } from "@/components/admin/settings-admin"

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: settings } = await supabase
    .from("app_settings")
    .select("sla_minutes")
    .eq("id", true)
    .single()

  return <SettingsAdmin slaMinutes={settings?.sla_minutes ?? 5} />
}
