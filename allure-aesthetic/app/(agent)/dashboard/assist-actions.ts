"use server"

import { createClient } from "@/lib/supabase/server"
import { loadBranches } from "@/lib/booking/branches"
import type { BranchData } from "@/components/dashboard/types"

// [category, what the customer says, recommended service, note]
export type GuideRow = [string, string, string, string]
export type FlowStep = { title: string; t?: string; note?: string }
export type Situation = { title: string; t: string }

export type AssistData = {
  guide: GuideRow[]
  flow: FlowStep[]
  situations: Situation[]
  branches: BranchData[]
}

/** Lazy-loads the "مين يرشح إيه" + "ردود الشات" drawer data (kb_articles +
 *  the same live branch data the dashboard uses for the dynamic cards). */
export async function getAssistData(): Promise<AssistData> {
  const supabase = await createClient()
  const [kbRes, branches] = await Promise.all([
    supabase
      .from("kb_articles")
      .select("slug, body")
      .in("slug", ["guide:recommendations", "chat:flow", "chat:situations"]),
    loadBranches(),
  ])
  const bySlug = new Map((kbRes.data ?? []).map((r) => [r.slug, r.body]))
  return {
    guide: (bySlug.get("guide:recommendations") as GuideRow[] | undefined) ?? [],
    flow: (bySlug.get("chat:flow") as FlowStep[] | undefined) ?? [],
    situations: (bySlug.get("chat:situations") as Situation[] | undefined) ?? [],
    branches,
  }
}

// Soft Skills drawer: all manual:* kb bodies, keyed without the "manual:" prefix.
export type ManualData = Record<string, unknown>

export async function getManualData(): Promise<ManualData> {
  const supabase = await createClient()
  const { data } = await supabase.from("kb_articles").select("slug, body").like("slug", "manual:%")
  return Object.fromEntries((data ?? []).map((r) => [r.slug.replace("manual:", ""), r.body]))
}
