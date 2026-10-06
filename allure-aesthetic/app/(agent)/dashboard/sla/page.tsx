import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SlaBoard } from "@/components/sla/sla-board"

export default async function SlaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin" && profile?.role !== "supervisor") {
    redirect("/dashboard")
  }

  const { data: tickets } = await supabase
    .from("ticket_board")
    .select("*")
    .eq("kind", "request")
    .eq("status", "pending")
    .order("sla_due_at", { ascending: true })

  return <SlaBoard initialTickets={tickets ?? []} />
}
