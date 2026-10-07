import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ServicesAdmin } from "@/components/admin/services-admin"

export default async function AdminServicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: services },
    { data: laserAreas },
    { data: laserConflicts },
    { data: laserCombos },
  ] = await Promise.all([
    supabase.from("services").select("*").order("sort"),
    supabase.from("laser_areas").select("*").order("sort"),
    supabase.from("laser_area_conflicts").select("*"),
    supabase.from("laser_area_combos").select("*").order("sort"),
  ])

  return (
    <ServicesAdmin
      services={services ?? []}
      laserAreas={laserAreas ?? []}
      laserConflicts={laserConflicts ?? []}
      laserCombos={laserCombos ?? []}
    />
  )
}
