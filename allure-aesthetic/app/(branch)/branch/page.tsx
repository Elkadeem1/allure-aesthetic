import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { cairoDayRange } from "@/lib/time"
import { BranchQueue } from "@/components/branch/branch-queue"

export default async function BranchPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "branch" || !profile.branch_id) redirect("/login")

  const branchId = profile.branch_id
  const { dateStr, startUtc, endUtc } = cairoDayRange()

  const [{ data: pendingTickets }, { data: historyTickets }, { data: doctors }] =
    await Promise.all([
      supabase
        .from("ticket_board")
        .select("*")
        .eq("branch_id", branchId)
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("ticket_board")
        .select("*")
        .eq("branch_id", branchId)
        .neq("status", "pending")
        .or(
          `and(created_at.gte.${startUtc},created_at.lt.${endUtc}),appt_date.eq.${dateStr}`,
        )
        .order("updated_at", { ascending: false })
        .limit(50),
      supabase
        .from("doctors")
        .select("id, display_name")
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .order("sort"),
    ])

  const all = pendingTickets ?? []
  const requests = all.filter((t: { kind: string }) => t.kind === "request")
  const notices = all.filter((t: { kind: string }) => t.kind === "notice")

  return (
    <div className="max-w-4xl">
      <BranchQueue
        userId={user.id}
        branchId={branchId}
        initialRequests={requests}
        initialNotices={notices}
        initialHistory={historyTickets ?? []}
        doctors={doctors ?? []}
      />
    </div>
  )
}
