import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DoctorsAdmin } from "@/components/admin/doctors-admin"

export default async function AdminDoctorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: doctors },
    { data: branches },
    { data: schedules },
    { data: doctorCutoffs },
    { data: laserAreas },
  ] = await Promise.all([
    supabase
      .from("doctors")
      .select("*")
      .order("sort"),
    supabase
      .from("branches")
      .select("id, name_ar")
      .eq("is_active", true)
      .order("sort"),
    supabase.from("doctor_schedules").select("*").order("weekday").order("start_time"),
    supabase.from("doctor_laser_cutoffs").select("*"),
    supabase.from("laser_areas").select("code, name_en, gender").order("sort"),
  ])

  return (
    <DoctorsAdmin
      doctors={doctors ?? []}
      branches={(branches ?? []).map((b) => ({ id: b.id, nameAr: b.name_ar }))}
      schedules={schedules ?? []}
      doctorCutoffs={doctorCutoffs ?? []}
      laserAreas={laserAreas ?? []}
    />
  )
}
