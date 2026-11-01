import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { cairoToday } from "@/lib/time"
import { UpdatesAdmin, type UpdateRow, type AdminBranch } from "@/components/admin/updates-admin"

export default async function AdminUpdatesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const today = cairoToday()

  const [updatesRes, branchesRes, doctorsRes, profilesRes] = await Promise.all([
    supabase
      .from("doctor_updates")
      .select(
        "id, branch_id, doctor_id, type, date_from, date_to, at_time, weekdays, segments, note, created_at, created_by, doctors(display_name), branches(name_ar, sort)"
      )
      .gte("date_to", today)
      .order("date_from"),
    supabase
      .from("branches")
      .select("id, name_ar, has_tickets, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase
      .from("doctors")
      .select("id, branch_id, display_name, sort")
      .eq("is_active", true)
      .order("sort"),
    supabase.from("profiles").select("id, full_name"),
  ])

  const whoById = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]))

  const branches: AdminBranch[] = (branchesRes.data ?? []).map((b) => ({
    id: b.id,
    nameAr: b.name_ar,
    sort: b.sort,
    doctors: (doctorsRes.data ?? [])
      .filter((d) => d.branch_id === b.id)
      .map((d) => ({ id: d.id, displayName: d.display_name })),
  }))

  const updates: UpdateRow[] = (updatesRes.data ?? []).map((u) => {
    const branch = u.branches as { name_ar: string; sort: number } | null
    const doctor = u.doctors as { display_name: string } | null
    return {
      id: u.id,
      branchId: u.branch_id,
      branchName: branch?.name_ar ?? "—",
      branchSort: branch?.sort ?? 999,
      doctorId: u.doctor_id,
      doctorName: doctor?.display_name ?? null,
      type: u.type,
      dateFrom: u.date_from,
      dateTo: u.date_to,
      atTime: u.at_time,
      weekdays: u.weekdays ?? [],
      segments: (u.segments as { start: string; end: string; kind?: string }[]) ?? [],
      note: u.note,
      createdAt: u.created_at,
      createdBy: u.created_by ? whoById.get(u.created_by) ?? null : null,
    }
  })

  return <UpdatesAdmin updates={updates} branches={branches} today={today} />
}
