import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BranchesAdmin } from "@/components/admin/branches-admin"

export default async function AdminBranchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: branches },
    { data: policies },
    { data: priceLists },
    { data: services },
    { data: branchServices },
    { data: branchCutoffs },
  ] = await Promise.all([
    supabase.from("branches").select("*").order("sort"),
    supabase.from("branch_policies").select("*"),
    supabase.from("price_lists").select("id, code, name"),
    supabase.from("services").select("id, code, name_ar").eq("is_active", true).order("sort"),
    supabase.from("branch_services").select("branch_id, service_id"),
    supabase.from("branch_laser_cutoffs").select("*"),
  ])

  return (
    <BranchesAdmin
      branches={branches ?? []}
      policies={policies ?? []}
      priceLists={priceLists ?? []}
      services={services ?? []}
      branchServices={branchServices ?? []}
      branchCutoffs={branchCutoffs ?? []}
    />
  )
}
