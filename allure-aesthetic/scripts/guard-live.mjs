// =====================================================================
// Guard for the HTML → DB sync scripts.
//
// Since go-live the DATABASE is the source of truth (admins edit doctors,
// schedules, branches, rooms and prices in the admin panel). Re-running the
// HTML sync would OVERWRITE those edits. These helpers make that impossible
// to do by accident — the operator must opt in with an explicit flag.
// =====================================================================
import { pathToFileURL } from 'node:url';

export const OVERRIDE_FLAG = '--i-know-this-overwrites-admin-edits';

export function hasOverride(argv = process.argv) {
  return argv.includes(OVERRIDE_FLAG);
}

/** True when this module file is the script node was invoked with. */
export function isMain(importMetaUrl) {
  return !!process.argv[1] && importMetaUrl === pathToFileURL(process.argv[1]).href;
}

function banner(lines) {
  console.error('\n' + '─'.repeat(68));
  for (const l of lines) console.error(l);
  console.error('─'.repeat(68) + '\n');
}

/**
 * Refuse to proceed unless the override flag is present. Use at the top of a
 * script whose output/action overwrites admin edits on the live DB.
 */
export function guardLiveOverwrite(what) {
  if (hasOverride()) {
    banner([
      `⚠️  ${OVERRIDE_FLAG} given.`,
      `   ${what} — this WILL overwrite admin edits made in the panel.`,
    ]);
    return;
  }
  banner([
    '⛔ REFUSING: the database is now the SOURCE OF TRUTH.',
    '',
    `   ${what}`,
    '   Admins edit doctors, schedules, branches and prices in the admin panel;',
    '   re-running the HTML sync would OVERWRITE those edits.',
    '',
    `   If you really mean to, re-run with:  ${OVERRIDE_FLAG}`,
  ]);
  process.exit(1);
}

/** Non-blocking notice for read-only scripts (dry runs). */
export function warnSourceOfTruth(note) {
  banner([
    'ℹ️  DB is the source of truth (admin panel edits win).',
    `   ${note}`,
    `   Applying HTML data to live overwrites admin edits — needs ${OVERRIDE_FLAG}.`,
  ]);
}
