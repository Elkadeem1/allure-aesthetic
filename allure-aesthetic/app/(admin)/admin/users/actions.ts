"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin, type ActionResult } from "@/lib/admin/guard"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapRpcError } from "@/lib/booking/message"
import type { AppRole } from "@/lib/types/database.types"

const BAN_FOREVER = "876000h" // ~100 years; revokes sessions + blocks login
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** branchId must reference an active branch that actually uses tickets. */
async function validateBranchRole(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  role: AppRole,
  branchId: string | null
): Promise<string | null> {
  if (role === "branch") {
    if (!branchId) return "مستخدم الفرع لازم يترتبط بفرع."
    const { data } = await supabase
      .from("branches")
      .select("has_tickets")
      .eq("id", branchId)
      .single()
    if (!data) return "الفرع غير موجود."
    if (!data.has_tickets) return "الفرع ده مالوش تيكتات — مينفعش يبقى له حساب فرع."
  } else if (branchId) {
    return "الدور ده مش فرع — مينفعش يترتبط بفرع."
  }
  return null
}

/** Would this change leave zero active admins? */
async function wouldDropLastAdmin(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  targetUserId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true)
  const admins = (data ?? []).map((p) => p.id)
  return admins.length <= 1 && admins.includes(targetUserId)
}

export async function createUserAction(args: {
  email: string
  password: string
  fullName: string
  role: AppRole
  branchId: string | null
}): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const email = args.email.trim().toLowerCase()
  const fullName = args.fullName.trim()
  if (!email || !args.password || !fullName) return { ok: false, error: "كل الحقول مطلوبة." }
  if (!EMAIL_RE.test(email)) return { ok: false, error: "البريد الإلكتروني غير صحيح." }
  if (args.password.length < 8) return { ok: false, error: "كلمة المرور لازم تكون 8 حروف على الأقل." }

  const branchErr = await validateBranchRole(supabase, args.role, args.branchId)
  if (branchErr) return { ok: false, error: branchErr }

  const admin = createAdminClient()
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: args.password,
    email_confirm: true,
  })
  if (authErr) return { ok: false, error: mapRpcError(authErr.message) }

  const { error: profErr } = await admin.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    role: args.role,
    branch_id: args.role === "branch" ? args.branchId : null,
  })
  if (profErr) {
    // Roll back the orphaned auth user.
    await admin.auth.admin.deleteUser(created.user.id)
    return { ok: false, error: mapRpcError(profErr.message) }
  }

  revalidatePath("/admin/users")
  return { ok: true }
}

export async function updateUserAction(args: {
  userId: string
  fullName: string
  role: AppRole
  branchId: string | null
}): Promise<ActionResult> {
  const { supabase, userId, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const fullName = args.fullName.trim()
  if (!fullName) return { ok: false, error: "الاسم مطلوب." }

  const branchErr = await validateBranchRole(supabase, args.role, args.branchId)
  if (branchErr) return { ok: false, error: branchErr }

  // Self-protection: can't demote yourself out of admin.
  if (args.userId === userId && args.role !== "admin") {
    return { ok: false, error: "مينفعش تغير دورك من مدير بنفسك." }
  }
  // Keep at least one active admin.
  if (args.role !== "admin" && (await wouldDropLastAdmin(supabase, args.userId))) {
    return { ok: false, error: "لازم يفضل مدير واحد فعال على الأقل." }
  }

  const { error: updErr } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      role: args.role,
      branch_id: args.role === "branch" ? args.branchId : null,
    })
    .eq("id", args.userId)

  if (updErr) return { ok: false, error: mapRpcError(updErr.message) }
  revalidatePath("/admin/users")
  return { ok: true }
}

export async function setUserActiveAction(args: {
  userId: string
  isActive: boolean
}): Promise<ActionResult> {
  const { supabase, userId, error } = await requireAdmin()
  if (error) return { ok: false, error }

  if (!args.isActive) {
    if (args.userId === userId) return { ok: false, error: "مينفعش توقف حسابك بنفسك." }
    if (await wouldDropLastAdmin(supabase, args.userId)) {
      return { ok: false, error: "لازم يفضل مدير واحد فعال على الأقل." }
    }
  }

  const admin = createAdminClient()
  // Ban (revokes sessions + blocks login) or lift the ban.
  const { error: banErr } = await admin.auth.admin.updateUserById(args.userId, {
    ban_duration: args.isActive ? "none" : BAN_FOREVER,
  })
  if (banErr) return { ok: false, error: mapRpcError(banErr.message) }

  const { error: profErr } = await admin
    .from("profiles")
    .update({ is_active: args.isActive })
    .eq("id", args.userId)
  if (profErr) return { ok: false, error: mapRpcError(profErr.message) }

  revalidatePath("/admin/users")
  return { ok: true }
}

export async function resetPasswordAction(args: {
  userId: string
  newPassword: string
}): Promise<ActionResult> {
  const { error } = await requireAdmin()
  if (error) return { ok: false, error }

  if (args.newPassword.length < 8) {
    return { ok: false, error: "كلمة المرور لازم تكون 8 حروف على الأقل." }
  }

  const admin = createAdminClient()
  const { error: pwErr } = await admin.auth.admin.updateUserById(args.userId, {
    password: args.newPassword,
  })
  if (pwErr) return { ok: false, error: mapRpcError(pwErr.message) }
  return { ok: true }
}
