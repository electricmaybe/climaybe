import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pc from 'picocolors';
import { HARNESS_MIN_NODE } from './harness.js';

export const THEME_CHECK_BASELINE_PATH = 'docs/harness/theme-check-baseline.json';

/**
 * @param {string} [version]
 * @returns {{ ok: boolean, major: number, minor: number, version: string }}
 */
export function parseNodeVersion(version = process.versions.node) {
  const parts = String(version).split('.').map((p) => Number.parseInt(p, 10));
  const major = Number.isFinite(parts[0]) ? parts[0] : 0;
  const minor = Number.isFinite(parts[1]) ? parts[1] : 0;
  const ok =
    major > HARNESS_MIN_NODE.major ||
    (major === HARNESS_MIN_NODE.major && minor >= HARNESS_MIN_NODE.minor);
  return { ok, major, minor, version: String(version) };
}

/**
 * Stable fingerprint for a Theme Check offense.
 * @param {object} offense
 */
export function offenseKey(offense) {
  const check = String(offense.check || offense.Check || '');
  const severity = String(offense.severity || offense.Severity || '').toLowerCase();
  const message = String(offense.message || offense.Message || '');
  let path = String(offense.path || offense.Path || offense.uri || offense.Uri || '');
  path = path.replace(/^file:\/\//, '');
  // Drop absolute prefix noise; keep trailing theme-relative segment when possible.
  const row = offense.start_row ?? offense.startRow ?? offense.line ?? offense.Line ?? '';
  const col = offense.start_col ?? offense.startCol ?? offense.column ?? offense.Column ?? '';
  return [check, severity, path, String(row), String(col), message].join('\u0001');
}

/**
 * Normalize Theme Check JSON into a sorted list of error-level offenses.
 * @param {unknown} raw
 * @returns {object[]}
 */
export function normalizeThemeCheckErrors(raw) {
  let offenses = [];
  if (Array.isArray(raw)) {
    offenses = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (raw);
    if (Array.isArray(obj.Offenses)) offenses = obj.Offenses;
    else if (Array.isArray(obj.offenses)) offenses = obj.offenses;
    else if (Array.isArray(obj.results)) offenses = obj.results;
    else if (Array.isArray(obj.Errors)) offenses = obj.Errors;
  }

  const errors = offenses.filter((o) => {
    if (!o || typeof o !== 'object') return false;
    const sev = String(o.severity || o.Severity || '').toLowerCase();
    return sev === 'error' || sev === '';
  });

  const normalized = errors.map((o) => {
    const check = String(o.check || o.Check || '');
    const severity = String(o.severity || o.Severity || 'error').toLowerCase() || 'error';
    const message = String(o.message || o.Message || '');
    let path = String(o.path || o.Path || o.uri || o.Uri || '');
    path = path.replace(/^file:\/\//, '');
    const start_row = o.start_row ?? o.startRow ?? o.line ?? o.Line ?? null;
    const start_col = o.start_col ?? o.startCol ?? o.column ?? o.Column ?? null;
    return {
      check,
      severity,
      path,
      message,
      start_row: start_row == null ? null : Number(start_row),
      start_col: start_col == null ? null : Number(start_col),
    };
  });

  normalized.sort((a, b) => offenseKey(a).localeCompare(offenseKey(b)));
  return normalized;
}

/**
 * @param {string} cwd
 * @returns {{ errors: object[], missing: boolean }}
 */
export function readBaseline(cwd = process.cwd()) {
  const path = join(cwd, THEME_CHECK_BASELINE_PATH);
  if (!existsSync(path)) return { errors: [], missing: true };
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    const list = Array.isArray(raw) ? raw : raw?.errors;
    return { errors: normalizeThemeCheckErrors(list || []), missing: false };
  } catch (err) {
    throw new Error(`Failed to parse ${THEME_CHECK_BASELINE_PATH}: ${err.message}`);
  }
}

/**
 * Deterministic baseline document.
 * @param {object[]} errors
 */
export function formatBaseline(errors) {
  const sorted = normalizeThemeCheckErrors(errors);
  return `${JSON.stringify({ version: 1, errors: sorted }, null, 2)}\n`;
}

/**
 * @param {object[]} current
 * @param {object[]} baseline
 * @returns {object[]}
 */
export function findNewErrors(current, baseline) {
  const known = new Set(baseline.map((e) => offenseKey(e)));
  return current.filter((e) => !known.has(offenseKey(e)));
}

/**
 * Run `shopify theme check --fail-level error --output json` (fall back to npx).
 * Injectable for tests.
 *
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {(args: string[], opts: {cwd: string}) => {status: number|null, stdout: string, stderr: string, error?: NodeJS.ErrnoException}} [options.runner]
 * @returns {{ ok: boolean, errors: object[], stdout: string, stderr: string, missingCli: boolean }}
 */
export function runThemeCheckJson({ cwd = process.cwd(), runner = defaultThemeCheckRunner } = {}) {
  const args = ['theme', 'check', '--fail-level', 'error', '--output', 'json'];
  const result = runner(args, { cwd });

  if (result.error?.code === 'ENOENT' || result.missingCli) {
    return {
      ok: false,
      errors: [],
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      missingCli: true,
    };
  }

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const trimmed = stdout.trim();
  if (!trimmed) {
    // Empty output: treat as zero offenses (Theme Check may exit non-zero with no JSON).
    return { ok: true, errors: [], stdout, stderr, missingCli: false, emptyOutput: true };
  }

  try {
    const parsed = JSON.parse(trimmed);
    const errors = normalizeThemeCheckErrors(parsed);
    return { ok: true, errors, stdout, stderr, missingCli: false, emptyOutput: false };
  } catch {
    // Some CLI versions wrap JSON among log lines — try last JSON object/array.
    const match = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])\s*$/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        const errors = normalizeThemeCheckErrors(parsed);
        return { ok: true, errors, stdout, stderr, missingCli: false, emptyOutput: false };
      } catch {
        // fall through
      }
    }
    return {
      ok: false,
      errors: [],
      stdout,
      stderr: stderr || 'Theme Check did not return valid JSON.',
      missingCli: false,
      emptyOutput: false,
      parseError: true,
    };
  }
}

function defaultThemeCheckRunner(args, { cwd }) {
  let result = spawnSync('shopify', args, {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error?.code === 'ENOENT') {
    result = spawnSync('npx', ['-y', '@shopify/cli@latest', ...args], {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error?.code === 'ENOENT') {
      return {
        status: null,
        stdout: '',
        stderr: 'Shopify CLI not found (tried `shopify` and `npx @shopify/cli@latest`).',
        error: result.error,
        missingCli: true,
      };
    }
  }
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error,
    missingCli: false,
  };
}

/**
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {boolean} [options.writeBaseline]
 * @param {boolean} [options.quiet] - one-line agent-friendly summary (for init.sh)
 * @param {string} [options.nodeVersion] - override process.versions.node for tests
 * @param {(args: string[], opts: {cwd: string}) => object} [options.runner]
 * @returns {number} process exit code
 */
export function runThemeCheckGate({
  cwd = process.cwd(),
  writeBaseline = false,
  quiet = false,
  nodeVersion = process.versions.node,
  runner,
} = {}) {
  const say = (msg, colorFn) => {
    if (quiet) {
      console.log(msg);
      return;
    }
    console.log(colorFn ? colorFn(msg) : msg);
  };

  const node = parseNodeVersion(nodeVersion);
  if (!node.ok) {
    say(
      quiet
        ? `theme check: FAILED (Node.js >= ${HARNESS_MIN_NODE.major}.${HARNESS_MIN_NODE.minor} required, found v${node.version})`
        : `  Node.js >= ${HARNESS_MIN_NODE.major}.${HARNESS_MIN_NODE.minor} required for Theme Check / Shopify CLI (found v${node.version}).`,
      quiet ? null : pc.red
    );
    return 1;
  }

  const check = runThemeCheckJson({ cwd, runner });
  if (check.missingCli) {
    if (quiet) {
      console.log('theme check: FAILED (Shopify CLI missing)');
    } else {
      console.log(pc.red('  Shopify CLI is missing.'));
      console.log(pc.dim('  Install Shopify CLI, or ensure npx can run @shopify/cli.'));
      if (check.stderr) console.log(pc.dim(`  ${check.stderr}`));
    }
    return 1;
  }
  if (check.parseError) {
    say(
      quiet ? 'theme check: FAILED (invalid JSON from Theme Check)' : '  Theme Check returned output that is not valid JSON.',
      quiet ? null : pc.red
    );
    if (!quiet && check.stderr) console.log(pc.dim(check.stderr));
    return 1;
  }

  if (writeBaseline) {
    const body = formatBaseline(check.errors);
    const outPath = join(cwd, THEME_CHECK_BASELINE_PATH);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, body, 'utf-8');
    say(
      quiet
        ? `theme check: wrote baseline (${check.errors.length} errors)`
        : `  Wrote ${THEME_CHECK_BASELINE_PATH} (${check.errors.length} error${check.errors.length === 1 ? '' : 's'}).`,
      quiet ? null : pc.green
    );
    return 0;
  }

  if (check.emptyOutput && !quiet) {
    console.log(pc.dim('  Theme Check produced empty JSON output — treating as 0 errors.'));
  }

  const baseline = readBaseline(cwd);
  if (baseline.missing) {
    if (check.errors.length === 0) {
      say(
        quiet ? 'theme check: 0 new errors (baseline 0)' : '  Theme Check: 0 errors (no baseline file).',
        quiet ? null : pc.green
      );
      return 0;
    }
    if (quiet) {
      console.log(`theme check: ${check.errors.length} new errors (baseline 0)`);
      printErrors(check.errors, { quiet: true });
    } else {
      console.log(
        pc.red(
          `  No baseline at ${THEME_CHECK_BASELINE_PATH} — treating all ${check.errors.length} error(s) as new.`
        )
      );
      console.log(pc.dim('  Hint: run `climaybe check --write-baseline` after reviewing Theme Check output.'));
      printErrors(check.errors);
    }
    return 1;
  }

  const neu = findNewErrors(check.errors, baseline.errors);
  if (neu.length === 0) {
    say(
      quiet
        ? `theme check: 0 new errors (baseline ${baseline.errors.length})`
        : `  Theme Check: ${check.errors.length} error(s) all known in baseline (${baseline.errors.length}).`,
      quiet ? null : pc.green
    );
    return 0;
  }

  if (quiet) {
    console.log(`theme check: ${neu.length} new errors (baseline ${baseline.errors.length})`);
    printErrors(neu, { quiet: true });
  } else {
    console.log(pc.red(`  Theme Check: ${neu.length} new error(s) not in baseline.`));
    printErrors(neu);
  }
  return 1;
}

function printErrors(errors, { quiet = false } = {}) {
  for (const e of errors.slice(0, 50)) {
    const loc =
      e.start_row != null ? `:${e.start_row}${e.start_col != null ? `:${e.start_col}` : ''}` : '';
    const line = `    - [${e.check}] ${e.path}${loc} — ${e.message}`;
    console.log(quiet ? line : pc.red(line));
  }
  if (errors.length > 50) {
    const more = `    … and ${errors.length - 50} more`;
    console.log(quiet ? more : pc.dim(more));
  }
}
