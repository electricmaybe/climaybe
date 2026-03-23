import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Bundled Electric Maybe Cursor rules + skills (shipped under src/cursor/). */
const BUNDLE_ROOT = join(__dirname, '..', 'cursor');

const SKIP_NAMES = new Set(['.DS_Store']);

/**
 * Recursively copy directory tree; skips junk files (e.g. .DS_Store).
 * @param {string} src
 * @param {string} dest
 */
function copyTree(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    if (SKIP_NAMES.has(name)) continue;
    const from = join(src, name);
    const to = join(dest, name);
    if (statSync(from).isDirectory()) {
      copyTree(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}

/**
 * Install bundled `.cursor/rules` and `.cursor/skills` into the target repo.
 * @param {string} [cwd] - Working directory (default process.cwd())
 * @returns {boolean} - false if bundle source is missing (broken install)
 */
export function scaffoldCursorBundle(cwd = process.cwd()) {
  const rulesSrc = join(BUNDLE_ROOT, 'rules');
  const skillsSrc = join(BUNDLE_ROOT, 'skills');
  if (!existsSync(rulesSrc) || !existsSync(skillsSrc)) {
    return false;
  }
  const cursorRoot = join(cwd, '.cursor');
  copyTree(rulesSrc, join(cursorRoot, 'rules'));
  copyTree(skillsSrc, join(cursorRoot, 'skills'));
  return true;
}
