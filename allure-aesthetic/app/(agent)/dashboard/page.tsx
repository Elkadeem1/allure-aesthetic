import { BranchTabs } from "@/components/dashboard/branch-tabs"
import { loadBranches } from "@/lib/booking/branches"

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

  return <BranchTabs branches={branches} initialCat={cat} />
}
