"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export type LoginState = {
  error?: "invalid_credentials" | "account_inactive" | "unknown"
}

const ROLE_HOME: Record<string, string> = {
  admin:      "/admin",
  supervisor: "/dashboard",
  agent:      "/dashboard",
  branch:     "/branch",
}

export async function signIn(
  _prevState: LoginState | undefined,
  formData: FormData
): Promise<LoginState> {
  const email    = (formData.get("email")    as string | null) ?? ""
  const password = (formData.get("password") as string | null) ?? ""

  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !auth.user) return { error: "invalid_credentials" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", auth.user.id)
    .single()

  if (!profile) return { error: "unknown" }

  if (!profile.is_active) {
    await supabase.auth.signOut()
    return { error: "account_inactive" }
  }

  redirect(ROLE_HOME[profile.role] ?? "/dashboard")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
