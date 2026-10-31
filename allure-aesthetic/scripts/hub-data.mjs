// Shared loader for docs/mvp/agent-hub-2026-10.html.
// script[0] holds plain globals (DATA, DEFS, SERVICES22, GUIDE, CHAT_*, manual
// tables). script[1] is an IIFE, so its data (SERVICES, laser areas, RULES,
// BRANCH_RULES) is read by slicing + evaluating. Used by extract-mvp.mjs and
// sync-hub.mjs so there is one source of the parsing logic.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_HTML = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  'docs/mvp/agent-hub-2026-10.html',
);

const noop = () => {};
const mk = () => new Proxy(noop, {
  get: (t, k) => (k === Symbol.iterator ? function* () {} : k === 'length' ? 0 : mk()),
  apply: () => mk(), set: () => true,
});
const baseCtx = () => ({
  document: mk(), window: mk(), localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  console, JSON, Math, Date, Object, Array, String, Number, Boolean, RegExp, Intl, Set, Map, Promise,
  parseInt, parseFloat, isNaN, isFinite, setTimeout: noop, clearTimeout: noop, setInterval: noop,
  clearInterval: noop, requestAnimationFrame: noop, queueMicrotask: noop,
  structuredClone: (x) => JSON.parse(JSON.stringify(x)),
});

const SCRIPT0_GLOBALS = [
  'DATA', 'BRANCH_LABELS', 'DAYS', 'DEFS', 'CATEGORY_INFO', 'CHIP_TO_SERVICE22', 'SERVICES22',
  'MANUAL_SECTIONS', 'GUIDE', 'CHAT_FLOW', 'CHAT_SITUATIONS', 'FILLER_BRAND_NOTES',
  'GOLDEN_RULES', 'MEDICAL_BOUNDARY', 'PRIVACY_RULES', 'VOICE_TABLE', 'EMPATHY_TABLE',
  'REPLACE_TABLE', 'CALL_STEPS', 'SCENARIOS', 'OBJECTIONS', 'OUTBOUND', 'OUTBOUND_RULES',
  'ESCALATION_MATRIX', 'HANDOVER_CARD', 'CONTACTS', 'QA_SCORECARD', 'CRITICAL_ERRORS',
  'KPIS', 'STATUS_MEANINGS', 'GLOSSARY', 'INNOVA_PRICE_CATEGORIES',
];

export function loadHubData(htmlPath = DEFAULT_HTML) {
  const raw = fs.readFileSync(htmlPath, 'utf8');
  const lines = raw.split('\n');
  const scripts = [...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

  // script[0] globals
  const ctx0 = baseCtx();
  vm.createContext(ctx0);
  try { vm.runInContext(scripts[0], ctx0); } catch { /* aborts after the data is defined */ }
  const capture = `globalThis.__O={};` + SCRIPT0_GLOBALS.map((k) => `try{__O[${JSON.stringify(k)}]=${k}}catch(e){}`).join('');
  vm.runInContext(capture, ctx0);
  const M = ctx0.__O;

  // script[1] IIFE data via slicing
  const indexOf = (re, from = 0) => { for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i; throw new Error('marker not found: ' + re); };
  const slice = (a, b) => lines.slice(a, b).join('\n');
  const helperA = indexOf(/^\s*const pad = /);
  const dataA = indexOf(/^const SERVICES = \[/);  // kept for clarity / marker validation
  const dataB = indexOf(/^const S = /);           // UI begins here
  void dataA;
  const code1 = [
    'const escapeHtml = s => String(s); const document = { getElementById: () => null };',
    `const DAYS = ${JSON.stringify(M.DAYS)};`,
    slice(helperA, dataB),
    `;({ SERVICES, LASER_WOMEN, LASER_MEN, AREA_CONFLICTS, RULES, BRANCH_RULES })`,
  ].join('\n');
  const M1 = vm.runInNewContext(code1, { console, Intl, Date, Math, JSON, Object, Array, String, Number, RegExp });
  Object.assign(M, M1);
  return M;
}

// Day name -> weekday index (Sat=0). The hub mixes alif-hamza spellings.
export function dayIndexer(DAYS) {
  const normDay = (s) => String(s).replace(/[إأآ]/g, 'ا');
  const idx = {};
  DAYS.forEach((d, i) => { idx[normDay(d)] = i; });
  return (name) => (normDay(name) in idx ? idx[normDay(name)] : -1);
}

export const slug = (n) => String(n || '').toLowerCase().replace(/^dr\.?\s+/, '').replace(/[^a-z؀-ۿ]/g, '');
