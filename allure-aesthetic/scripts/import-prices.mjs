#!/usr/bin/env node
// =====================================================================
// Price-list importer for the per-branch price model (migration 6).
//
// Sources of truth:
//   * docs/data/price-list.xlsx — ALL prices for the 6 Egypt branches.
//       sheet "قائمة الأسعار"      descriptive columns (group/variant/unit/…)
//       sheet "الأسعار حسب الفرع"  one price column per branch
//       sheet "الأقسام"            category codes + names
//   * docs/mvp/agent-hub-2026-10.html — Innova prices only (INNOVA_PRICE_
//       CATEGORIES + DATA.innova.consultations), emitted as INV-xxx codes.
//
// The item code (Excel "كود البند") is stable; we UPSERT by code and never
// delete. Codes no longer present in the sources are set is_active = false.
//
// Usage:
//   node scripts/import-prices.mjs            # emit idempotent SQL to stdout
//   node scripts/import-prices.mjs --sql      # same
//   node scripts/import-prices.mjs --json     # emit the normalised model (dry run)
//
// The admin panel's "upload price list" button can reuse loadPriceModel()
// + priceSql() (or a future upsertModel() that writes via supabase-js).
// =====================================================================
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const XLSX_PATH = path.join(root, 'docs/data/price-list.xlsx');
const HTML_PATH = path.join(root, 'docs/mvp/agent-hub-2026-10.html');

// Excel branch column header -> our branch code.
const BRANCH_BY_HEADER = {
  'التجمع الخامس': 'newcairo',
  'طنطا شارع السعيد': 'tanta2',
  'طنطا شارع الاستاد': 'tanta1',
  'المنصورة': 'mansoura',
  'كفر الشيخ': 'kafrelsheikh',
  'شبين الكوم': 'shebin',
};

// Category code -> knowledge-base slug (DEFS keys) + "يبدأ من" overrides.
const CATEGORY_KB = {
  FIL: 'def:filler', BTX: 'def:botox', LSR: 'def:laser', MES: 'def:meso',
  PEL: 'def:peeling', SKB: 'def:skinbooster', PLA: 'def:pllaexo', EXO: 'def:pllaexo',
};
const CATEGORY_STARTS_FROM = { DPN: 750 };

// laser_area code -> { single, pkg } Excel item codes. Women and men are
// separate items; men have no 3-session package. Multi-area keys are bundles.
const LASER_MAP = [
  // women singles
  { areas: ['w_face'],        gender: 'female', single: 'LSR-01', pkg: 'LSR-02' },
  { areas: ['w_halfarms'],    gender: 'female', single: 'LSR-07', pkg: 'LSR-08' },
  { areas: ['w_fullarms'],    gender: 'female', single: 'LSR-09', pkg: 'LSR-10' },
  { areas: ['w_halflegup'],   gender: 'female', single: 'LSR-11', pkg: 'LSR-12' },
  { areas: ['w_halflegdn'],   gender: 'female', single: 'LSR-13', pkg: 'LSR-14' },
  { areas: ['w_fulllegs'],    gender: 'female', single: 'LSR-15', pkg: 'LSR-16' },
  { areas: ['w_fbnb'],        gender: 'female', single: 'LSR-17', pkg: 'LSR-18' },
  { areas: ['w_fb'],          gender: 'female', single: 'LSR-19', pkg: 'LSR-20' },
  // women bundles
  { areas: ['w_face', 'w_neck'],      gender: 'female', single: 'LSR-03', pkg: 'LSR-04' },
  { areas: ['w_bikini', 'w_underarm'], gender: 'female', single: 'LSR-05', pkg: 'LSR-06' },
  // men singles (no package)
  { areas: ['m_ears'],      gender: 'male', single: 'LSR-27', pkg: null },
  { areas: ['m_beard'],     gender: 'male', single: 'LSR-28', pkg: null },
  { areas: ['m_halfface'],  gender: 'male', single: 'LSR-29', pkg: null },
  { areas: ['m_underarm'],  gender: 'male', single: 'LSR-30', pkg: null },
  { areas: ['m_halfarms'],  gender: 'male', single: 'LSR-31', pkg: null },
  { areas: ['m_fullarms'],  gender: 'male', single: 'LSR-32', pkg: null },
  { areas: ['m_chest'],     gender: 'male', single: 'LSR-33', pkg: null },
  { areas: ['m_back'],      gender: 'male', single: 'LSR-34', pkg: null },
  { areas: ['m_legs'],      gender: 'male', single: 'LSR-35', pkg: null },
  { areas: ['m_upper'],     gender: 'male', single: 'LSR-37', pkg: null },
  { areas: ['m_fbnobox'],   gender: 'male', single: 'LSR-38', pkg: null },
  { areas: ['m_fbbox'],     gender: 'male', single: 'LSR-39', pkg: null },
  // men bundle (no package)
  { areas: ['m_chest', 'm_back'], gender: 'male', single: 'LSR-36', pkg: null },
];

// Doctor-specific items: Excel CON-05..08 in Kafr El-Sheikh.
const ITEM_DOCTORS = {
  'CON-05': [['kafrelsheikh', 'kholoudfayrouz'], ['kafrelsheikh', 'shimaahassan']],
  'CON-06': [['kafrelsheikh', 'kholoudfayrouz'], ['kafrelsheikh', 'shimaahassan']],
  'CON-07': [['kafrelsheikh', 'kholoudfayrouz'], ['kafrelsheikh', 'shimaahassan']],
  'CON-08': [['kafrelsheikh', 'kholoudfayrouz'], ['kafrelsheikh', 'shimaahassan']],
};

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const cellText = (c) => {
  const v = c?.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if ('text' in v) return v.text;
    if ('result' in v) return v.result;
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('hyperlink' in v) return v.text || v.hyperlink;
    return '';
  }
  return v;
};
const str = (v) => String(v ?? '').trim();
const priceNum = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------------
// Read the Innova prices + consultations from the HTML (script globals).
// ---------------------------------------------------------------------
function readInnovaFromHtml(htmlPath) {
  const scripts = [...fs.readFileSync(htmlPath, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const noop = () => {};
  const mk = () => new Proxy(noop, {
    get: (t, k) => {
      if (k === Symbol.iterator) return function* () {};
      if (k === 'length') return 0;
      return mk();
    },
    apply: () => mk(), set: () => true,
  });
  const ctx = {
    document: mk(), window: mk(), localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    console, JSON, Math, Date, Object, Array, String, Number, Boolean, RegExp, Intl, Set, Map, Promise,
    parseInt, parseFloat, isNaN, isFinite, setTimeout: noop, clearTimeout: noop, setInterval: noop,
    clearInterval: noop, requestAnimationFrame: noop, queueMicrotask: noop,
    structuredClone: (x) => JSON.parse(JSON.stringify(x)),
  };
  vm.createContext(ctx);
  // Only the first <script> holds INNOVA_PRICE_CATEGORIES and DATA; running it
  // defines them as context globals (top-level const persist in this vm ctx).
  try { vm.runInContext(scripts[0], ctx); } catch { /* aborts after data is set */ }
  const out = vm.runInContext(
    'globalThis.__X = { innovaCats: (typeof INNOVA_PRICE_CATEGORIES!=="undefined"?INNOVA_PRICE_CATEGORIES:null),' +
    ' innovaCons: (typeof DATA!=="undefined"&&DATA.innova?DATA.innova.consultations:null) };' +
    'globalThis.__X', ctx);
  if (!out.innovaCats) throw new Error('INNOVA_PRICE_CATEGORIES not found in HTML');
  return out;
}

// ---------------------------------------------------------------------
// Build the normalised price model from both sources.
// ---------------------------------------------------------------------
export async function loadPriceModel({ xlsxPath = XLSX_PATH, htmlPath = HTML_PATH } = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  const categories = [];   // {code, name_ar, name_en, sort, kb_slug, starts_from}
  const items = [];        // {code, category_code, group_name, variant, unit, full_name, item_type, availability_text, notes, price_text, sort}
  const branchPrices = []; // {code, branch, price}
  const unmapped = { itemsWithoutLaserOrService: [], notes: [] };

  // --- categories (sheet الأقسام) ---
  const catSheet = wb.getWorksheet('الأقسام');
  let csort = 0;
  catSheet.eachRow((row, rn) => {
    if (rn === 1) return;
    const code = str(cellText(row.getCell(1)));
    if (!code) return;
    categories.push({
      code,
      name_ar: str(cellText(row.getCell(2))),
      name_en: str(cellText(row.getCell(3))) || null,
      sort: csort++,
      kb_slug: CATEGORY_KB[code] || null,
      starts_from: CATEGORY_STARTS_FROM[code] ?? null,
    });
  });

  // --- descriptive columns (sheet قائمة الأسعار), keyed by item code ---
  const descSheet = wb.getWorksheet('قائمة الأسعار');
  const desc = new Map();
  let isort = 0;
  descSheet.eachRow((row, rn) => {
    if (rn === 1) return;
    const code = str(cellText(row.getCell(1)));
    if (!code) return;
    const typeAr = str(cellText(row.getCell(8))); // نوع البند: خدمة / إضافة
    desc.set(code, {
      code,
      category_ar: str(cellText(row.getCell(2))),
      group_name: str(cellText(row.getCell(4))) || null,
      variant: str(cellText(row.getCell(5))) || null,
      unit: str(cellText(row.getCell(6))) || null,
      full_name: str(cellText(row.getCell(7))),
      item_type: typeAr === 'إضافة' ? 'addon' : 'service',
      availability_text: str(cellText(row.getCell(11))) || null,
      notes: str(cellText(row.getCell(12))) || null,
      sort: isort++,
    });
  });

  // category code by Arabic name (to attach Excel items to a category code).
  const catCodeByAr = new Map(categories.map((c) => [c.name_ar, c.code]));

  // --- per-branch prices (sheet الأسعار حسب الفرع) ---
  const priceSheet = wb.getWorksheet('الأسعار حسب الفرع');
  const header = priceSheet.getRow(1);
  const branchCol = {}; // col index -> branch code
  header.eachCell((cell, col) => {
    const code = BRANCH_BY_HEADER[str(cellText(cell))];
    if (code) branchCol[col] = code;
  });

  priceSheet.eachRow((row, rn) => {
    if (rn === 1) return;
    const code = str(cellText(row.getCell(1)));
    if (!code) return;
    const d = desc.get(code);
    if (!d) { unmapped.notes.push(`price row ${code} has no descriptive row in "قائمة الأسعار"`); return; }
    const catCode = catCodeByAr.get(d.category_ar);
    if (!catCode) unmapped.notes.push(`item ${code}: category "${d.category_ar}" not in "الأقسام"`);
    items.push({
      code,
      category_code: catCode || null,
      group_name: d.group_name,
      variant: d.variant,
      unit: d.unit,
      full_name: d.full_name,
      item_type: d.item_type,
      availability_text: d.availability_text,
      notes: d.notes,
      price_text: null,
      sort: d.sort,
    });
    for (const [col, branch] of Object.entries(branchCol)) {
      const p = priceNum(cellText(row.getCell(Number(col))));
      if (p !== null) branchPrices.push({ code, branch, price: p });
    }
  });

  // --- Innova prices from the HTML (INV-xxx) ---
  const { innovaCats, innovaCons } = readInnovaFromHtml(htmlPath);
  const INNOVA_CAT_OF = (label) =>
    /تنظيف|اكواشور/.test(label) ? 'SKC' : /Laser|ليزر|نبض|منطق/.test(label) ? 'LSR' : 'OTH';
  let inv = 0;
  const invCode = () => `INV-${String(++inv).padStart(3, '0')}`;
  for (const cat of innovaCats) {
    for (const [label, price] of cat.items) {
      const code = invCode();
      items.push({
        code, category_code: INNOVA_CAT_OF(cat.cat),
        group_name: cat.cat, variant: label, unit: null,
        full_name: `${cat.cat} - ${label}`, item_type: 'service',
        availability_text: 'Innova فقط', notes: null, price_text: null, sort: 1000 + inv,
      });
      const p = priceNum(price);
      if (p !== null) branchPrices.push({ code, branch: 'innova', price: p });
    }
  }
  // Innova consultations -> CON category. Re Cons is free within a month (text).
  const CONSULT_VARIANT = { 'Cons Derma': 'كشف جلدية', 'Cons Hair': 'كشف شعر', 'Re Cons': 'إعادة كشف' };
  for (const c of innovaCons || []) {
    const code = invCode();
    const isRe = c.name === 'Re Cons';
    items.push({
      code, category_code: 'CON', group_name: 'كشف Innova',
      variant: CONSULT_VARIANT[c.name] || c.name, unit: null,
      full_name: `كشف Innova - ${CONSULT_VARIANT[c.name] || c.name}`, item_type: 'service',
      availability_text: 'Innova فقط', notes: null,
      price_text: isRe ? 'مجاني خلال شهر' : null, sort: 1000 + inv,
    });
    const p = priceNum(c.price);
    if (p !== null) branchPrices.push({ code, branch: 'innova', price: p });
  }

  // --- laser map: validate against known item codes ---
  const itemCodes = new Set(items.map((i) => i.code));
  const laserMap = [];
  for (const m of LASER_MAP) {
    if (!itemCodes.has(m.single)) unmapped.notes.push(`laser map: single item ${m.single} for [${m.areas}] not in price list`);
    laserMap.push(m);
  }

  // doctor links (only for codes that exist)
  const doctorLinks = [];
  for (const [code, pairs] of Object.entries(ITEM_DOCTORS)) {
    if (!itemCodes.has(code)) { unmapped.notes.push(`doctor-link item ${code} not in price list`); continue; }
    for (const [branch, doctor] of pairs) doctorLinks.push({ code, branch, doctor });
  }

  return {
    categories, items, branchPrices, doctorLinks, laserMap,
    allCodes: [...itemCodes], unmapped,
  };
}

// ---------------------------------------------------------------------
// Emit idempotent SQL (no transaction wrapper; caller wraps it).
// ---------------------------------------------------------------------
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const qArr = (a) => (a && a.length ? `array[${a.map(q).join(', ')}]::text[]` : `'{}'::text[]`);
const branchId = (c) => `(select id from public.branches where code = ${q(c)})`;
const catId = (c) => `(select id from public.price_categories where code = ${q(c)})`;
const itemId = (c) => `(select id from public.price_items where code = ${q(c)})`;

export function priceSql(model) {
  const out = [];
  const emit = (s = '') => out.push(s);

  emit('-- ---- Price categories ----');
  for (const c of model.categories) {
    emit(`insert into public.price_categories (code, name_ar, name_en, sort, kb_slug, starts_from, is_active)
values (${q(c.code)}, ${q(c.name_ar)}, ${q(c.name_en)}, ${c.sort}, ${q(c.kb_slug)}, ${c.starts_from ?? 'null'}, true)
on conflict (code) do update set
  name_ar = excluded.name_ar, name_en = excluded.name_en, sort = excluded.sort,
  kb_slug = excluded.kb_slug, starts_from = excluded.starts_from, is_active = true;`);
  }
  emit();

  emit('-- ---- Price items ----');
  for (const it of model.items) {
    emit(`insert into public.price_items (code, category_id, group_name, variant, unit, full_name, item_type, availability_text, notes, price_text, sort, is_active)
values (${q(it.code)}, ${it.category_code ? catId(it.category_code) : 'null'}, ${q(it.group_name)}, ${q(it.variant)}, ${q(it.unit)}, ${q(it.full_name)}, ${q(it.item_type)}, ${q(it.availability_text)}, ${q(it.notes)}, ${q(it.price_text)}, ${it.sort}, true)
on conflict (code) do update set
  category_id = excluded.category_id, group_name = excluded.group_name, variant = excluded.variant,
  unit = excluded.unit, full_name = excluded.full_name, item_type = excluded.item_type,
  availability_text = excluded.availability_text, notes = excluded.notes,
  price_text = excluded.price_text, sort = excluded.sort, is_active = true;`);
  }
  emit();

  // Deactivate any item whose code is no longer in the sources.
  emit('-- Items no longer in the sources -> is_active = false (never deleted).');
  emit(`update public.price_items set is_active = false where code <> all (${qArr(model.allCodes)});`);
  emit();

  emit('-- ---- Per-branch prices (delete + insert per item = idempotent) ----');
  const byItem = new Map();
  for (const bp of model.branchPrices) {
    if (!byItem.has(bp.code)) byItem.set(bp.code, []);
    byItem.get(bp.code).push(bp);
  }
  for (const [code, rows] of byItem) {
    emit(`delete from public.price_item_branch_prices where item_id = ${itemId(code)};`);
    const values = rows.map((r) => `(${itemId(code)}, ${branchId(r.branch)}, ${r.price})`).join(',\n  ');
    emit(`insert into public.price_item_branch_prices (item_id, branch_id, price) values\n  ${values};`);
  }
  emit();

  emit('-- ---- Doctor-specific items ----');
  for (const dl of model.doctorLinks) {
    emit(`insert into public.price_item_doctors (item_id, doctor_id)
select pi.id, d.id from public.price_items pi, public.doctors d
where pi.code = ${q(dl.code)} and d.code = ${q(dl.doctor)} and d.branch_id = ${branchId(dl.branch)}
on conflict do nothing;`);
  }
  emit();

  emit('-- ---- Laser area -> price item map ----');
  model.laserMap.forEach((m, i) => {
    emit(`insert into public.laser_area_price_map (area_codes, gender, single_item_code, package3_item_code, sort)
values (${qArr(m.areas)}, ${q(m.gender)}, ${q(m.single)}, ${q(m.pkg)}, ${i})
on conflict (area_codes) do update set
  gender = excluded.gender, single_item_code = excluded.single_item_code,
  package3_item_code = excluded.package3_item_code, sort = excluded.sort;`);
  });

  return out.join('\n');
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const mode = process.argv.includes('--json') ? 'json' : 'sql';
  const model = await loadPriceModel();
  for (const n of model.unmapped.notes) process.stderr.write('warn: ' + n + '\n');
  if (mode === 'json') {
    process.stdout.write(JSON.stringify(model, null, 2) + '\n');
  } else {
    process.stdout.write('begin;\n' + priceSql(model) + '\ncommit;\n');
  }
}
