import { createClient } from "@/lib/supabase/server"
import { ServicesGuide, type Svc } from "@/components/services/services-guide"

export default async function ServicesGuidePage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("kb_articles")
    .select("slug, body, sort")
    .like("slug", "service:%")
    .order("sort")

  const services = (data ?? []).map((r) => r.body as unknown as Svc).filter((s) => s && s.id)

  return <ServicesGuide services={services} />
}
