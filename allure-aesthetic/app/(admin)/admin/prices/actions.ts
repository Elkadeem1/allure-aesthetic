"use server"

import { revalidatePath } from "next/cache"
import ExcelJS from "exceljs"
import { requireAdmin, type ActionResult } from "@/lib/admin/guard"
import { mapRpcError } from "@/lib/booking/message"
import { parseWorkbook } from "@/lib/admin/prices/excel.mjs"
import {
  diffPriceImport,
  type ImportDiff,
  type ParsedItem,
  type ParsedPrice,
} from "@/lib/admin/prices/diff"
import type { Json } from "@/lib/types/database.types"

type PriceModel = {
  categories: unknown[]
  items: ParsedItem[]
  branchPrices: ParsedPrice[]
}

type ParseError = { sheet: string; row: number; message: string }

export type PreviewResult =
  | { ok: false; error: string }
  | { ok: true; fileName: string; errors: ParseError[]; diff: ImportDiff; model: PriceModel }

// ---------------------------------------------------------------------
// Shared: current DB snapshot used for the diff (preview + apply).
// ---------------------------------------------------------------------
async function loadDbSnapshot(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"]) {
  const [itemsRes, branchesRes, pricesRes] = await Promise.all([
    supabase.from("price_items").select("id, code, full_name, is_active"),
    supabase.from("branches").select("id, code, name_ar"),
    supabase.from("price_item_branch_prices").select("item_id, branch_id, price"),
  ])
  const items = itemsRes.data ?? []
  const branches = branchesRes.data ?? []
  const codeByItemId = new Map(items.map((i) => [i.id, i.code]))
  const codeByBranchId = new Map(branches.map((b) => [b.id, b.code]))
  const branchNames: Record<string, string> = Object.fromEntries(branches.map((b) => [b.code, b.name_ar]))

  const dbItems = items.map((i) => ({ code: i.code, full_name: i.full_name, is_active: i.is_active }))
  const dbPrices = (pricesRes.data ?? [])
    .map((p) => ({
      code: codeByItemId.get(p.item_id),
      branch: codeByBranchId.get(p.branch_id),
      price: p.price,
    }))
    .filter((p): p is { code: string; branch: string; price: number } => !!p.code && !!p.branch)

  return { dbItems, dbPrices, branchNames }
}

// ---------------------------------------------------------------------
// Step 1 + 2: upload -> parse/validate -> preview diff
// ---------------------------------------------------------------------
export async function previewPriceImportAction(formData: FormData): Promise<PreviewResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "ارفع ملف Excel الأول." }

  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(await file.arrayBuffer())
  } catch {
    return { ok: false, error: "مش قادرين نقرأ الملف — اتأكد إنه Excel صحيح." }
  }

  const parsed = parseWorkbook(wb) as PriceModel & { errors: ParseError[] }
  const model: PriceModel = {
    categories: parsed.categories,
    items: parsed.items,
    branchPrices: parsed.branchPrices,
  }

  if (parsed.errors.length > 0) {
    const empty: ImportDiff = { counts: { newItems: 0, changedItems: 0, deactivatedItems: 0 }, changes: [] }
    return { ok: true, fileName: file.name, errors: parsed.errors, diff: empty, model }
  }

  const snap = await loadDbSnapshot(supabase)
  const diff = diffPriceImport({
    fileItems: model.items,
    filePrices: model.branchPrices,
    ...snap,
  })
  return { ok: true, fileName: file.name, errors: [], diff, model }
}

// ---------------------------------------------------------------------
// Step 3: apply in one transaction (RPC). Counts recomputed server-side.
// ---------------------------------------------------------------------
export async function applyPriceImportAction(args: {
  model: PriceModel
  fileName: string
}): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const { model, fileName } = args
  if (!model || !Array.isArray(model.items) || !Array.isArray(model.categories)) {
    return { ok: false, error: "بيانات الاستيراد ناقصة — ارفع الملف تاني." }
  }

  // Recompute counts against the live DB so the history row is honest.
  const snap = await loadDbSnapshot(supabase)
  const { counts } = diffPriceImport({ fileItems: model.items, filePrices: model.branchPrices, ...snap })

  const { error: rpcErr } = await supabase.rpc("admin_apply_price_import", {
    p_categories: model.categories as Json,
    p_items: model.items as unknown as Json,
    p_branch_prices: model.branchPrices as unknown as Json,
    p_file_name: fileName,
    p_counts: counts as unknown as Json,
  })
  if (rpcErr) return { ok: false, error: mapRpcError(rpcErr.message) }

  revalidatePath("/admin/prices")
  revalidatePath("/dashboard")
  return { ok: true }
}

// ---------------------------------------------------------------------
// Manual editing
// ---------------------------------------------------------------------
function revalidatePrices() {
  revalidatePath("/admin/prices")
  revalidatePath("/dashboard")
}

export async function setItemBranchPriceAction(args: {
  itemId: string
  branchId: string
  price: number | null // null = not available, 0 = free
}): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  if (args.price !== null && (!Number.isFinite(args.price) || args.price < 0)) {
    return { ok: false, error: "السعر لازم يكون رقم موجب أو صفر." }
  }

  if (args.price === null) {
    const { error: e } = await supabase
      .from("price_item_branch_prices")
      .delete()
      .eq("item_id", args.itemId)
      .eq("branch_id", args.branchId)
    if (e) return { ok: false, error: mapRpcError(e.message) }
  } else {
    const { error: e } = await supabase
      .from("price_item_branch_prices")
      .upsert({ item_id: args.itemId, branch_id: args.branchId, price: args.price }, { onConflict: "item_id,branch_id" })
    if (e) return { ok: false, error: mapRpcError(e.message) }
  }
  revalidatePrices()
  return { ok: true }
}

export async function updatePriceItemAction(args: {
  itemId: string
  unit: string | null
  notes: string | null
  isActive: boolean
}): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const { error: e } = await supabase
    .from("price_items")
    .update({ unit: args.unit?.trim() || null, notes: args.notes?.trim() || null, is_active: args.isActive })
    .eq("id", args.itemId)
  if (e) return { ok: false, error: mapRpcError(e.message) }
  revalidatePrices()
  return { ok: true }
}

export async function createPriceItemAction(args: {
  categoryId: string
  code: string
  fullName: string
  groupName: string | null
  variant: string | null
  unit: string | null
  itemType: "service" | "addon"
}): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  const code = args.code.trim()
  if (!code) return { ok: false, error: "الكود مطلوب." }
  if (!args.fullName.trim()) return { ok: false, error: "اسم البند مطلوب." }

  const { error: e } = await supabase.from("price_items").insert({
    category_id: args.categoryId,
    code,
    full_name: args.fullName.trim(),
    group_name: args.groupName?.trim() || null,
    variant: args.variant?.trim() || null,
    unit: args.unit?.trim() || null,
    item_type: args.itemType,
  })
  if (e) {
    if (/duplicate key|unique/i.test(e.message)) return { ok: false, error: "الكود ده موجود قبل كده." }
    return { ok: false, error: mapRpcError(e.message) }
  }
  revalidatePrices()
  return { ok: true }
}

export async function updateCategoryStartsFromAction(args: {
  categoryId: string
  startsFrom: number | null
}): Promise<ActionResult> {
  const { supabase, error } = await requireAdmin()
  if (error) return { ok: false, error }

  if (args.startsFrom !== null && (!Number.isFinite(args.startsFrom) || args.startsFrom < 0)) {
    return { ok: false, error: "«يبدأ من» لازم يكون رقم موجب أو فاضي." }
  }

  const { error: e } = await supabase
    .from("price_categories")
    .update({ starts_from: args.startsFrom })
    .eq("id", args.categoryId)
  if (e) return { ok: false, error: mapRpcError(e.message) }
  revalidatePrices()
  return { ok: true }
}
