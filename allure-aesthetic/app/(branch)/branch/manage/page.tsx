import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { cairoToday } from "@/lib/time"
import { BranchManage } from "@/components/branch/branch-manage"

export default async function BranchManagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "branch" || !profile.branch_id) redirect("/login")

  const branchId = profile.branch_id
  const today = cairoToday()

  const [
    { data: branch },
    { data: doctors },
    { data: doctorUpdates },
    { data: schedules },
    { data: services },
  ] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name_ar")
      .eq("id", branchId)
      .single(),
    supabase
      .from("doctors")
      .select("id, display_name, default_booking_status, notes, sort")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("sort"),
    supabase
      .from("doctor_updates")
      .select("*")
      .eq("branch_id", branchId)
      .gte("date_to", today)
      .order("created_at", { ascending: false }),
    supabase
      .from("doctor_schedules")
      .select("id, doctor_id, weekday, start_time, end_time, kind")
      .in(
        "doctor_id",
        (await supabase
          .from("doctors")
          .select("id")
          .eq("branch_id", branchId)
          .eq("is_active", true)
        ).data?.map((d) => d.id) ?? [],
      )
      .order("weekday")
      .order("start_time"),
    supabase
      .from("branch_services")
      .select("services(id, code, name_ar)")
      .eq("branch_id", branchId),
  ])

  const branchServices = (services ?? [])
    .map((s) => (s as { services: { id: string; code: string; name_ar: string } }).services)
    .filter(Boolean)

  return (
    <BranchManage
      branchId={branchId}
      branchName={branch?.name_ar ?? ""}
      today={today}
      doctors={
        (doctors ?? []).map((d) => ({
          id: d.id,
          displayName: d.display_name,
          defaultBookingStatus: d.default_booking_status,
          notes: d.notes,
          sort: d.sort,
        }))
      }
      initialUpdates={
        (doctorUpdates ?? []).map((u) => ({
          id: u.id,
          doctorId: u.doctor_id,
          type: u.type,
          dateFrom: u.date_from,
          dateTo: u.date_to,
          note: u.note,
          segments: (u.segments as Array<{ start: string; end: string; kind?: string }>) ?? [],
          createdAt: u.created_at,
        }))
      }
      initialSchedules={
        (schedules ?? []).map((s) => ({
          id: s.id,
          doctorId: s.doctor_id,
          weekday: s.weekday,
          startTime: s.start_time,
          endTime: s.end_time,
          kind: s.kind,
        }))
      }
      services={branchServices}
    />
  )
}
