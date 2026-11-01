import { BranchTabs } from "@/components/dashboard/branch-tabs"
import { loadBranches } from "@/lib/booking/branches"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>
}) {
  const { cat } = await searchParams
  const branches = await loadBranches()

  if (branches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-semibold text-muted-foreground">لا توجد فروع نشطة</p>
      </div>
    )
  }

  // Admins get the inline "+ Update" shortcut on each doctor row.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    isAdmin = profile?.role === "admin"
  }

  return <BranchTabs branches={branches} initialCat={cat} isAdmin={isAdmin} />
}
