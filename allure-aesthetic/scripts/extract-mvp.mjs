#!/usr/bin/env node
// =====================================================================
// Generates supabase/seed.sql from the agent hub (docs/mvp/agent-hub-2026-10.html)
// for everything EXCEPT prices, then appends the price model produced by
// scripts/import-prices.mjs (Excel + Innova HTML).
//
// The hub is the source of truth for fresh setups; after go-live the admin
// panel takes over and this script is only for seeding a new database.
//
// Writes are idempotent:
//   * entity tables with a stable code (branches, services, doctors,
//     rooms, laser_areas) UPSERT by code and deactivate codes that have
//     left the source (never delete — keeps ticket history intact);
//   * pure child/link tables (schedules, room assignments, conflicts,
//     branch_services, kb_articles, …) are refreshed with delete + insert
//     (no ticket FK points at them, so this is safe to re-run live).
//
// Usage: node scripts/extract-mvp.mjs [path/to/hub.html] > supabase/seed.sql
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPriceModel, priceSql } from './import-prices.mjs';
import { loadHubData, dayIndexer, slug } from './hub-data.mjs';
import { guardLiveOverwrite, isMain } from './guard-live.mjs';

// The emitted SQL UPSERTs the whole catalogue by code — applying it to the
// live DB overwrites admin-panel edits. Refuse unless explicitly overridden.
if (isMain(import.meta.url)) {
  guardLiveOverwrite('extract-mvp emits idempotent UPSERT SQL for the whole catalogue.');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(root, 'docs/mvp/agent-hub-2026-10.html');

// ---------------------------------------------------------------------
// 1) Load the hub data (shared loader).
// ---------------------------------------------------------------------
const M = loadHubData(htmlPath);

// ---------------------------------------------------------------------
// 2) Helpers
// ---------------------------------------------------------------------
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const qArr = (a) => (a && a.length ? `array[${a.map(q).join(', ')}]::text[]` : `'{}'::text[]`);
const qJson = (v) => `${q(JSON.stringify(v))}::jsonb`;
const stripTags = (s) => String(s).replace(/<[^>]+>/g, '');
const branchId = (bk) => `(select id from public.branches where code = ${q(bk)})`;
const doctorId = (bk, dc) => `(select id from public.doctors where code = ${q(dc)} and branch_id = ${branchId(bk)})`;
const roomId = (bk, rc) => `(select id from public.rooms where code = ${q(rc)} and branch_id = ${branchId(bk)})`;
const toTime = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Day name -> weekday index (Sat=0); handles the hub's alif-hamza spellings.
const dayIndex = dayIndexer(M.DAYS);

// Same shift parser as the MVP engine (parseDay).
const SHIFT_RE = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[–\-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)(.*)$/i;
const h12 = (h, m, ap) => { let x = (+h) % 12; if (/pm/i.test(ap)) x += 12; return x * 60 + (+m || 0); };
function parseDay(val) {
  if (!val) return [];
  return String(val).split(/\n/).map((line) => {
    const m = line.match(SHIFT_RE);
    if (!m) return null;
    const rest = m[7] || ''; let kind = 'all';
    if (/ليزر/.test(rest)) kind = 'laser';
    else if (/باقي الخدمات|خدمات أخرى|خدمات اخرى/.test(rest)) kind = 'other';
    else if (/جلدية/.test(rest)) kind = 'derma';
    return { from: h12(m[1], m[2], m[3]), to: h12(m[4], m[5], m[6]), kind };
  }).filter(Boolean);
}

const out = [];
const emit = (s = '') => out.push(s);
const warn = (s) => process.stderr.write('warn: ' + s + '\n');

// ---------------------------------------------------------------------
// 3) Services — the new SERVICES list (incl. vascular, body/calcium
//    filler, devices). kb_slug links into kb_articles.
// ---------------------------------------------------------------------
const SVC22_SLUG = {
  consult: 'derma_consult', laser: 'laser_hair', vascular: 'laser_vascular',
  filler: 'filler_face', fillerbody: 'filler_body', fillercalcium: 'filler_calcium',
  botox: 'botox', skinbooster: 'skinbooster', plla: 'plla', exosomes: 'exosomes',
  meso: 'meso', plasma: 'prp', goldplasma: 'prp', gcell: 'gcell', threads: 'threads',
  cleansing: 'cleansing', peel: 'peeling', dermaother: 'derma_other', dental: 'dental',
  cynosure: 'laser_hair', fractional: 'fractional', hifu: 'hifu', dermapen: 'dermapen',
  vivace: 'vivace', oxygeneo: 'cleansing', aquashur: 'cleansing',
};
const svcKb = (s) => (SVC22_SLUG[s.id] ? 'service:' + SVC22_SLUG[s.id] : s.def ? 'def:' + s.def : null);
const SERVICES = M.SERVICES;
const svcCodes = SERVICES.map((s) => s.id);

// ---------------------------------------------------------------------
// 4) Laser areas
// ---------------------------------------------------------------------
const AREAS = M.LASER_WOMEN.map((a) => ({ ...a, gender: 'female' }))
  .concat(M.LASER_MEN.map((a) => ({ ...a, gender: 'male' })));

// ---------------------------------------------------------------------
// 5) Per-branch booking policy (tickets are Innova-only now; these only
//    affect the dentolize_status the assistant shows for the others).
// ---------------------------------------------------------------------
const POLICIES = {
  tanta1: { auto_confirm_weekdays: [0] },     // Saturday: Open doctors confirmed
  tanta2: { same_day_always_request: true },
  shebin: { allow_overlap: false },
};
const BRANCHES = Object.keys(M.BRANCH_LABELS);

// =====================================================================
// Emit
// =====================================================================
emit('-- =====================================================================');
emit('-- GENERATED by scripts/extract-mvp.mjs from docs/mvp/agent-hub-2026-10.html');
emit('-- Prices appended from scripts/import-prices.mjs (Excel + Innova HTML).');
emit('-- Do not edit by hand — change the generator or use the admin panel.');
emit('-- =====================================================================');
emit('begin;');
emit();

// Refresh pure child/link tables (safe to delete: no ticket FK points here).
emit('-- Refresh child/link tables (delete + insert = idempotent reseed)');
for (const t of [
  'doctor_rooms', 'doctor_schedules', 'doctor_laser_cutoffs', 'branch_laser_cutoffs',
  'branch_services', 'laser_area_conflicts', 'laser_area_combos', 'laser_area_price_map',
  'price_item_doctors', 'price_item_branch_prices', 'kb_articles',
]) emit(`delete from public.${t};`);
emit();

// ---- Branches ----
emit('-- Branches');
BRANCHES.forEach((bk, i) => {
  const b = M.DATA[bk];
  const hasTickets = bk === 'innova';
  const logo = bk === 'innova' ? '/brand/innova-logo.svg' : null;
  emit(`insert into public.branches (code, name_ar, address, payment_methods, managers, has_tickets, logo_url, is_active, sort) values
  (${q(bk)}, ${q(b.name)}, ${q(b.address)}, ${qArr(b.payment)}, ${qArr(b.managers)}, ${hasTickets}, ${q(logo)}, true, ${i})
on conflict (code) do update set
  name_ar = excluded.name_ar, address = excluded.address, payment_methods = excluded.payment_methods,
  managers = excluded.managers, has_tickets = excluded.has_tickets, logo_url = excluded.logo_url,
  is_active = true, sort = excluded.sort;`);
  const p = POLICIES[bk] || {};
  emit(`insert into public.branch_policies (branch_id, request_window_days, same_day_always_request, auto_confirm_weekdays, allow_overlap, booking_rules) values
  (${branchId(bk)}, 1, ${!!p.same_day_always_request}, ${p.auto_confirm_weekdays ? `array[${p.auto_confirm_weekdays.join(',')}]::smallint[]` : `'{}'::smallint[]`}, ${p.allow_overlap !== false}, ${qArr((b.bookingRules || []).map(stripTags))})
on conflict (branch_id) do update set
  request_window_days = excluded.request_window_days, same_day_always_request = excluded.same_day_always_request,
  auto_confirm_weekdays = excluded.auto_confirm_weekdays, allow_overlap = excluded.allow_overlap,
  booking_rules = excluded.booking_rules;`);
});
emit();

// ---- Branch laser cut-offs (BRANCH_RULES) ----
emit('-- Branch laser cut-offs');
for (const [bk, brr] of Object.entries(M.BRANCH_RULES || {})) {
  if (!brr.laserCutoff) continue;
  for (const day of brr.laserCutoff.days) {
    emit(`insert into public.branch_laser_cutoffs (branch_id, weekday, shift_starts_before, cutoff) values (${branchId(bk)}, ${dayIndex(day)}, ${q(brr.laserCutoff.before)}, ${q(brr.laserCutoff.at)});`);
  }
}
emit();

// ---- Rooms (Innova) ----
emit('-- Rooms');
BRANCHES.forEach((bk) => {
  (M.DATA[bk].rooms || []).forEach((r, i) => {
    emit(`insert into public.rooms (branch_id, code, title, sort) values (${branchId(bk)}, ${q(r.key)}, ${q(r.title)}, ${i})
on conflict (branch_id, code) do update set title = excluded.title, sort = excluded.sort;`);
  });
});
emit();

// ---- Services ----
emit('-- Services');
SERVICES.forEach((s, i) => {
  emit(`insert into public.services (code, name_ar, name_en, default_duration_min, uses_laser_areas, kb_slug, sort, is_active) values
  (${q(s.id)}, ${q(s.ar)}, ${q(s.en)}, 30, ${s.id === 'laser'}, ${q(svcKb(s))}, ${i}, true)
on conflict (code) do update set
  name_ar = excluded.name_ar, name_en = excluded.name_en, uses_laser_areas = excluded.uses_laser_areas,
  kb_slug = excluded.kb_slug, sort = excluded.sort, is_active = true;`);
});
emit(`update public.services set is_active = false where code <> all (${qArr(svcCodes)});`);
emit();

// ---- branch_services ----
emit('-- Branch services');
BRANCHES.forEach((bk) => {
  const b = M.DATA[bk];
  SERVICES.forEach((s) => {
    const offered = s.id === 'consult' || s.all === true || (s.match && (b.services || []).some((x) => s.match.test(x)));
    if (offered) emit(`insert into public.branch_services (branch_id, service_id) values (${branchId(bk)}, (select id from public.services where code = ${q(s.id)}));`);
  });
  (b.services || []).forEach((x) => {
    if (!SERVICES.some((s) => s.match && s.match.test(x))) warn(`[${bk}] service chip not mapped: ${x}`);
  });
});
emit();

// ---- Laser areas / conflicts / combos ----
emit('-- Laser areas');
AREAS.forEach((a, i) => {
  emit(`insert into public.laser_areas (code, gender, name_en, hint_ar, duration_min, is_small, is_full_body, requires_companion, sort) values
  (${q(a.id)}, ${q(a.gender)}, ${q(a.ar)}, ${q(a.hint)}, ${a.min || 0}, ${!!a.small}, ${!!a.fb}, ${!!a.needsOther}, ${i})
on conflict (code) do update set
  gender = excluded.gender, name_en = excluded.name_en, hint_ar = excluded.hint_ar,
  duration_min = excluded.duration_min, is_small = excluded.is_small,
  is_full_body = excluded.is_full_body, requires_companion = excluded.requires_companion, sort = excluded.sort;`);
});
for (const [a, list] of Object.entries(M.AREA_CONFLICTS)) {
  for (const b of list) emit(`insert into public.laser_area_conflicts (area_code, conflicts_with) values (${q(a)}, ${q(b)}) on conflict do nothing;`);
}
emit(`insert into public.laser_area_combos (label, required_codes, any_of_codes, duration_adjust_min, sort) values
  ('كومبو Half-Legs + Half-Arms = ٣٠ دقيقة', array['w_halfarms'], array['w_halflegup','w_halflegdn'], -30, 0),
  ('كومبو Under Arms + Bikini + Bikini Line = ٣٠ دقيقة', array['w_underarm','w_bikini','w_bikiniline'], '{}', 0, 1);`);
emit();

// ---- Doctors + schedules + room assignments ----
emit('-- Doctors');
const allDoctorKeys = [];
const usedRules = new Set();
BRANCHES.forEach((bk) => {
  M.DATA[bk].doctors.forEach((d, di) => {
    const dc = slug(d.name);
    allDoctorKeys.push([bk, dc]);
    const key = bk + ':' + dc;
    const r = M.RULES[key] || {};
    if (M.RULES[key]) usedRules.add(key);
    const notes = [d.notes, r.note].filter(Boolean).join(' — ') || null;
    const isOpen = r.status === 'Open';
    emit(`insert into public.doctors (branch_id, code, display_name, person_key, default_booking_status, always_open, accepts_men, laser_men_allowed, men_laser_area_codes, rejects_small_areas_only, no_overlap, specialty, notes, is_active, sort) values
  (${branchId(bk)}, ${q(dc)}, ${q(d.name)}, ${q(dc)}, ${q(isOpen ? 'open' : 'confirmed')}, ${isOpen}, ${!r.noMen}, ${!r.noLaserMen}, ${r.menLaserAreas ? qArr(r.menLaserAreas) : 'null'}, ${!!r.noSmallAreas}, ${!!r.noOverlapEver}, ${q(d.specialty)}, ${q(notes)}, true, ${di})
on conflict (branch_id, code) do update set
  display_name = excluded.display_name, person_key = excluded.person_key,
  default_booking_status = excluded.default_booking_status, always_open = excluded.always_open,
  accepts_men = excluded.accepts_men, laser_men_allowed = excluded.laser_men_allowed,
  men_laser_area_codes = excluded.men_laser_area_codes, rejects_small_areas_only = excluded.rejects_small_areas_only,
  no_overlap = excluded.no_overlap, specialty = excluded.specialty, notes = excluded.notes,
  is_active = true, sort = excluded.sort;`);

    for (const [day, val] of Object.entries(d.week || {})) {
      const wd = dayIndex(day);
      if (wd < 0) { warn(`[${key}] unknown day "${day}"`); continue; }
      const segs = parseDay(val);
      if (!segs.length && val && !/إجازة/.test(val)) warn(`[${key}] unparsed schedule "${day}": ${val}`);
      segs.forEach((s) => emit(`insert into public.doctor_schedules (doctor_id, weekday, start_time, end_time, kind) values (${doctorId(bk, dc)}, ${wd}, ${q(toTime(s.from))}, ${q(toTime(s.to))}, ${q(s.kind)});`));
    }
    for (const [day, t] of Object.entries(r.laserCutoff || {})) {
      emit(`insert into public.doctor_laser_cutoffs (doctor_id, weekday, cutoff) values (${doctorId(bk, dc)}, ${dayIndex(day)}, ${q(t)});`);
    }
    for (const [day, rk] of Object.entries(d.roomByDay || {})) {
      const wd = dayIndex(day);
      if (wd < 0) continue;
      emit(`insert into public.doctor_rooms (doctor_id, weekday, room_id) values (${doctorId(bk, dc)}, ${wd}, ${roomId(bk, rk)}) on conflict (doctor_id, weekday) do update set room_id = excluded.room_id;`);
    }
    if (d.consultOverride) warn(`[${key}] consultOverride ignored — consultation prices now come from the Excel (CON-05..08)`);
    if (d.tempNote) warn(`[${key}] tempNote not imported (operational; manage as a doctor_update): ${d.tempNote}`);
  });
});
// Deactivate doctors that left the source (keep the row for ticket history).
const dkeys = allDoctorKeys.map(([bk, dc]) => `(${branchId(bk)}, ${q(dc)})`).join(',\n  ');
emit(`update public.doctors set is_active = false where (branch_id, code) not in (\n  ${dkeys}\n);`);
Object.keys(M.RULES).forEach((k) => { if (!usedRules.has(k)) warn(`RULES key matched no doctor: ${k}`); });
emit();

// ---- Knowledge base ----
emit('-- Knowledge base');
let kbSort = 0;
const kb = (slugStr, kind, title, body) =>
  emit(`insert into public.kb_articles (slug, kind, title, body, sort) values (${q(slugStr)}, ${q(kind)}, ${q(title)}, ${qJson(body)}, ${kbSort++});`);
(M.SERVICES22 || []).forEach((s) => kb('service:' + s.id, 'service', s.name, s));
Object.entries(M.DEFS || {}).forEach(([k, d]) => kb('def:' + k, 'definition', d.title, d));
const MANUAL_KEYS = [
  'GOLDEN_RULES', 'MEDICAL_BOUNDARY', 'PRIVACY_RULES', 'VOICE_TABLE', 'EMPATHY_TABLE',
  'REPLACE_TABLE', 'CALL_STEPS', 'SCENARIOS', 'OBJECTIONS', 'OUTBOUND', 'OUTBOUND_RULES',
  'ESCALATION_MATRIX', 'HANDOVER_CARD', 'CONTACTS', 'QA_SCORECARD', 'CRITICAL_ERRORS',
  'KPIS', 'STATUS_MEANINGS', 'GLOSSARY', 'FILLER_BRAND_NOTES',
];
MANUAL_KEYS.forEach((k) => { if (M[k]) kb('manual:' + k.toLowerCase(), 'manual', k, M[k]); });
if (M.MANUAL_SECTIONS) kb('manual:sections', 'manual', 'MANUAL_SECTIONS', M.MANUAL_SECTIONS);
// NEW reference content
if (M.GUIDE) kb('guide:recommendations', 'guide', 'مين يرشح إيه', M.GUIDE);
if (M.CHAT_FLOW) kb('chat:flow', 'chat', 'خطوات شات واتساب', M.CHAT_FLOW);
if (M.CHAT_SITUATIONS) kb('chat:situations', 'chat', 'مواقف شات واتساب', M.CHAT_SITUATIONS);
emit();

// ---- Prices (Excel + Innova HTML) ----
emit('-- Prices (generated by scripts/import-prices.mjs)');
const model = await loadPriceModel({ htmlPath });
for (const n of model.unmapped.notes) warn('price: ' + n);
emit(priceSql(model));
emit();

emit('commit;');
process.stdout.write(out.join('\n') + '\n');
