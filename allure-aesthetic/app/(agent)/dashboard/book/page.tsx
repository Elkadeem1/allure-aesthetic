import { loadBookingData } from "@/lib/booking/data"
import { BookingWizard } from "@/components/wizard/booking-wizard"

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>
}) {
  const { branch } = await searchParams
  const data = await loadBookingData()

  return (
    <div className="max-w-5xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground">حجز جديد</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          اختار الخطوات والمساعد هيقولك تبعت طلب ولا إشعار ولا تحجز على طول.
        </p>
      </div>

      {data.branches.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد فروع متاحة.</p>
      ) : (
        <BookingWizard data={data} initialBranchId={branch} />
      )}
    </div>
  )
}
