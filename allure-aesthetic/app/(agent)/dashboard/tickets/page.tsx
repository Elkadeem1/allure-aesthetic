import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { cairoDayRange } from "@/lib/time"
import { TicketsList } from "@/components/tickets/tickets-list"

export default async function TicketsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { startUtc, endUtc, dateStr } = cairoDayRange()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const role = profile?.role ?? "agent"
  const mineOnly = role === "agent"

  // Show: tickets created today (Cairo) OR whose appointment is today OR any
  // ticket still open (pending/answered) regardless of date — an agent must
  // never lose an open ticket.
  const orFilter = `and(created_at.gte.${startUtc},created_at.lt.${endUtc}),appt_date.eq.${dateStr},status.in.(pending,answered)`

  let query = supabase
    .from("ticket_board")
    .select("*")
    .or(orFilter)
    .order("created_at", { ascending: false })
  if (mineOnly) query = query.eq("created_by", user.id)

  const [{ data: tickets }, { data: doctors }] = await Promise.all([
    query,
    supabase.from("doctors").select("id, display_name"),
  ])

  const doctorNames = Object.fromEntries((doctors ?? []).map((d) => [d.id, d.display_name]))

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground">تيكتاتي</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {mineOnly ? "التيكتات اللي بعتّها النهاردة" : "كل تيكتات النهاردة"}
        </p>
      </div>

      <TicketsList
        initialTickets={tickets ?? []}
        doctorNames={doctorNames}
        userId={user.id}
        mineOnly={mineOnly}
        orFilter={orFilter}
      />
    </div>
  )
}
