import { createClient } from "@/lib/supabase/server"
import { cairoDayRange } from "@/lib/time"
import { TicketsList, type Ticket } from "@/components/tickets/tickets-list"

export default async function TicketsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { startUtc, endUtc, dateStr } = cairoDayRange()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
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
  if (mineOnly) query = query.eq("created_by", user!.id)

  const { data: rows } = await query

  // ticket_board has no offered_time (it predates migration 6) — merge it in.
  const ids = (rows ?? []).map((r) => r.id).filter((x): x is string => !!x)
  const { data: offs } = ids.length
    ? await supabase.from("tickets").select("id, offered_time").in("id", ids)
    : { data: [] }
  const offMap = new Map((offs ?? []).map((o) => [o.id, o.offered_time]))
  const tickets: Ticket[] = (rows ?? []).map((r) => ({
    ...r,
    id: r.id as string,
    ticket_no: r.ticket_no as number,
    offered_time: r.id ? offMap.get(r.id) ?? null : null,
  }))

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground">My Tickets</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {mineOnly ? "التيكتات اللي بعتّها النهاردة" : "كل تيكتات النهاردة"}
        </p>
      </div>

      <TicketsList
        initialTickets={tickets}
        userId={user!.id}
        mineOnly={mineOnly}
        orFilter={orFilter}
      />
    </div>
  )
}
