import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BranchesAdmin, type BranchRow } from "@/components/admin/branches-admin"

export default async function AdminBranchesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [branchesRes, policiesRes, roomsRes, cutoffsRes] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name_ar, address, payment_methods, managers, has_tickets, logo_url, is_active, sort")
      .order("sort"),
    supabase.from("branch_policies").select("branch_id, booking_rules"),
    supabase.from("rooms").select("id, branch_id, code, title, sort, is_active").order("sort"),
    supabase.from("branch_laser_cutoffs").select("branch_id, weekday, shift_starts_before, cutoff"),
  ])

  const rulesByBranch = new Map((policiesRes.data ?? []).map((p) => [p.branch_id, p.booking_rules ?? []]))

  const branches: BranchRow[] = (branchesRes.data ?? []).map((b) => ({
    id: b.id,
    nameAr: b.name_ar,
    address: b.address,
    paymentMethods: b.payment_methods ?? [],
    managers: b.managers ?? [],
    bookingRules: rulesByBranch.get(b.id) ?? [],
    hasTickets: b.has_tickets,
    logoUrl: b.logo_url,
    isActive: b.is_active,
    rooms: (roomsRes.data ?? [])
      .filter((r) => r.branch_id === b.id)
      .map((r) => ({ id: r.id, code: r.code, title: r.title, sort: r.sort, isActive: r.is_active })),
    cutoffs: (cutoffsRes.data ?? [])
      .filter((c) => c.branch_id === b.id)
      .map((c) => ({ weekday: c.weekday, shiftStartsBefore: c.shift_starts_before, cutoff: c.cutoff })),
  }))

  return <BranchesAdmin branches={branches} />
}
