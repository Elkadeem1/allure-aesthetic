import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types/database.types"

type Supabase = SupabaseClient<Database>

export type ActionResult = { ok: true } | { ok: false; error: string }

type Guard =
  | { supabase: Supabase; userId: string; error: null }
  | { supabase: Supabase; userId: null; error: string }

/**
 * Every admin server action starts here: confirms the caller is a logged-in,
 * active admin. Returns the user-scoped client (so RLS still applies and
 * `created_by`/audit stays correct) plus the admin's own user id.
 */
export async function requireAdmin(): Promise<Guard> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, userId: null, error: "مش مسجل دخول." }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin" || !profile.is_active) {
    return { supabase, userId: null, error: "غير مصرح — المدير فقط." }
  }
  return { supabase, userId: user.id, error: null }
}
