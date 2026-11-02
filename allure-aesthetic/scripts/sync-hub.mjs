#!/usr/bin/env node
// =====================================================================
// Idempotent HTML-data sync (branches, doctors, schedules, rooms,
// services, laser data, kb_articles) for the LIVE Supabase DB.
//
// The apply step is the idempotent SQL emitted by scripts/extract-mvp.mjs:
// every entity table UPSERTs by code and sets is_active = false for codes
// that have left the source (never deleted); child/link tables are
// refreshed. This script is the **dry run**: it reads live over the REST
// API (service_role, read-only) and reports, per table, how many rows the
// sync would insert / update / deactivate.
//
// Usage:
//   node scripts/sync-hub.mjs           # dry run against live (read-only)
//   node scripts/sync-hub.mjs --json    # same, as JSON
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHubData, slug } from './hub-data.mjs';
import { warnSourceOfTruth, guardLiveOverwrite } from './guard-live.mjs';

// Read-only dry run, but it drives the HTML sync that would overwrite admin
// edits. Warn always; refuse an actual --apply without explicit opt-in.
warnSourceOfTruth('sync-hub is a read-only dry run.');
if (process.argv.includes('--apply')) {
  guardLiveOverwrite('--apply would write the HTML catalogue to the live DB.');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- env ---
function readEnv() {
  const txt = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
  const env = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
const env = readEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// Read a whole table (paged). Returns { rows } or { missing:true } on 404.
async function restAll(table, select) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
      headers: { ...HEADERS, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (res.status === 404 || res.status === 400) return { missing: true };
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return { rows };
}

// --- desired state from the hub ---
const M = loadHubData();
const BRANCHES = Object.keys(M.BRANCH_LABELS);
const desired = {
  branches: new Set(BRANCHES),
  services: new Set(M.SERVICES.map((s) => s.id)),
  doctors: new Set(BRANCHES.flatMap((bk) => M.DATA[bk].doctors.map((d) => `${bk}:${slug(d.name)}`))),
  rooms: new Set(BRANCHES.flatMap((bk) => (M.DATA[bk].rooms || []).map((r) => `${bk}:${r.key}`))),
  laser_areas: new Set([...M.LASER_WOMEN, ...M.LASER_MEN].map((a) => a.id)),
  kb_articles: new Set([
    ...M.SERVICES22.map((s) => 'service:' + s.id),
    ...Object.keys(M.DEFS).map((k) => 'def:' + k),
    ...['GOLDEN_RULES', 'MEDICAL_BOUNDARY', 'PRIVACY_RULES', 'VOICE_TABLE', 'EMPATHY_TABLE',
        'REPLACE_TABLE', 'CALL_STEPS', 'SCENARIOS', 'OBJECTIONS', 'OUTBOUND', 'OUTBOUND_RULES',
        'ESCALATION_MATRIX', 'HANDOVER_CARD', 'CONTACTS', 'QA_SCORECARD', 'CRITICAL_ERRORS',
        'KPIS', 'STATUS_MEANINGS', 'GLOSSARY', 'FILLER_BRAND_NOTES'].filter((k) => M[k]).map((k) => 'manual:' + k.toLowerCase()),
    'manual:sections', 'guide:recommendations', 'chat:flow', 'chat:situations',
  ]),
};
// child / link tables that the sync refreshes (delete + insert); report desired counts
const childDesired = {
  doctor_schedules: BRANCHES.reduce((n, bk) => n + M.DATA[bk].doctors.reduce((m, d) => m + Object.values(d.week || {}).join('\n').split('\n').filter((l) => /(AM|PM)/i.test(l)).length, 0), 0),
  doctor_rooms: BRANCHES.reduce((n, bk) => n + M.DATA[bk].doctors.reduce((m, d) => m + Object.keys(d.roomByDay || {}).length, 0), 0),
  branch_services: null,
};

// --- compare ---
const report = {};
async function diffEntity(table, select, keyer, desiredSet, canDeactivate) {
  const live = await restAll(table, select);
  if (live.missing) {
    report[table] = { live: 'missing (pre-migration)', desired: desiredSet.size, insert: desiredSet.size, update: 0, deactivate: 0 };
    return;
  }
  const liveKeys = new Map(); // key -> is_active
  for (const r of live.rows) liveKeys.set(keyer(r), r.is_active ?? null);
  let insert = 0, update = 0, deactivate = 0;
  for (const k of desiredSet) (liveKeys.has(k) ? update++ : insert++);
  if (canDeactivate) for (const [k, active] of liveKeys) if (!desiredSet.has(k) && active !== false) deactivate++;
  report[table] = { live: live.rows.length, desired: desiredSet.size, insert, update, deactivate: canDeactivate ? deactivate : 'n/a' };
}

await diffEntity('branches', 'code,is_active', (r) => r.code, desired.branches, true);
await diffEntity('services', 'code,is_active', (r) => r.code, desired.services, true);
await diffEntity('doctors', 'code,is_active,branches(code)', (r) => `${r.branches?.code}:${r.code}`, desired.doctors, true);
await diffEntity('rooms', 'code,branches(code)', (r) => `${r.branches?.code}:${r.code}`, desired.rooms, false);
await diffEntity('laser_areas', 'code', (r) => r.code, desired.laser_areas, false);
await diffEntity('kb_articles', 'slug', (r) => r.slug, desired.kb_articles, false);

// --- output ---
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ report, childDesired }, null, 2));
} else {
  console.log('HTML-data sync — DRY RUN against live (read-only)\n');
  console.log('table'.padEnd(18), 'live'.padStart(8), 'desired'.padStart(8), 'insert'.padStart(7), 'update'.padStart(7), 'deactiv'.padStart(8));
  for (const [t, r] of Object.entries(report)) {
    console.log(t.padEnd(18), String(r.live).padStart(8), String(r.desired).padStart(8),
      String(r.insert).padStart(7), String(r.update).padStart(7), String(r.deactivate).padStart(8));
  }
  console.log('\nchild/link tables (refreshed on apply):');
  for (const [t, n] of Object.entries(childDesired)) console.log('  ', t, '→', n === null ? 'per-branch set' : `${n} rows`);
  console.log('\nApply: run migration 6, then `node scripts/extract-mvp.mjs | psql <LIVE_DB_URL>`');
  console.log('(idempotent: upsert by code, missing → is_active=false), then import-prices + post-sync.sql.');
}
