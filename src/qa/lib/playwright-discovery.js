import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Build Playwright testDir + testMatch so shared climaybe journeys/universal
 * and theme-repo qa/specs/** are both discoverable.
 *
 * Theme CI must not pass `qa/specs` as a lone CLI path: Playwright then
 * replaces testDir and would drop shared specs. Discovery belongs in config.
 *
 * @param {{
 *   themeRoot: string,
 *   sharedDir: string,
 *   cliArgs?: string[],
 * }} opts
 * @returns {{
 *   testDir: string,
 *   testMatch: string[],
 *   themeSpecsDir: string | null,
 *   sharedRel: string,
 *   explicitCliPaths: boolean,
 * }}
 */
export function buildStoreQaPlaywrightDiscovery(opts) {
  const themeRoot = opts.themeRoot || process.cwd();
  const sharedDir = opts.sharedDir;
  const cliArgs = opts.cliArgs || process.argv.slice(2);

  const explicitCliPaths = cliArgs.some((arg) => isExplicitTestPathArg(arg));
  const sharedRel = normalizeRel(relative(themeRoot, sharedDir)) || '.';
  const themeSpecsDir = existsSync(join(themeRoot, 'qa', 'specs'))
    ? join(themeRoot, 'qa', 'specs')
    : null;

  // When callers pass explicit file/dir paths (e.g. a single theme spec),
  // drop the journeys/universal-only filter so those paths are not zeroed out.
  if (explicitCliPaths) {
    return {
      testDir: themeRoot,
      testMatch: [
        '**/*.spec.js',
        '**/*.spec.mjs',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.test.js',
        '**/*.test.mjs',
        '**/*.test.ts',
        '**/*.test.tsx',
        '*.spec.js',
        '*.spec.mjs',
        '*.spec.ts',
        '*.test.js',
      ],
      themeSpecsDir,
      sharedRel,
      explicitCliPaths: true,
    };
  }

  const testMatch = [
    `${sharedRel}/journeys/**/*.spec.js`,
    `${sharedRel}/journeys/**/*.spec.mjs`,
    `${sharedRel}/journeys/**/*.spec.ts`,
    `${sharedRel}/universal/**/*.spec.js`,
    `${sharedRel}/universal/**/*.spec.mjs`,
    `${sharedRel}/universal/**/*.spec.ts`,
    'qa/specs/**/*.spec.js',
    'qa/specs/**/*.spec.mjs',
    'qa/specs/**/*.spec.ts',
  ];

  return {
    testDir: themeRoot,
    testMatch,
    themeSpecsDir,
    sharedRel,
    explicitCliPaths: false,
  };
}

/**
 * Whether a relative path under testDir matches any testMatch glob.
 * Used by unit tests (and debugging) without requiring @playwright/test.
 * @param {string} filePath relative to testDir, posix-ish
 * @param {string[]} testMatch
 */
export function pathMatchesTestMatch(filePath, testMatch) {
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  return (testMatch || []).some((pattern) => matchSimpleGlob(normalized, pattern));
}

/**
 * @param {string} arg
 */
function isExplicitTestPathArg(arg) {
  const a = String(arg || '');
  if (!a || a.startsWith('-')) return false;
  // Playwright subcommands / config flags values are not paths we care about
  if (a === 'test' || a === 'install' || a === 'show-report') return false;
  if (a.endsWith('.config.js') || a.endsWith('.config.ts') || a.endsWith('.config.mjs')) return false;
  return (
    a.includes('qa/specs') ||
    a.includes('qa\\specs') ||
    /\.(spec|test)\.(js|mjs|ts|tsx)$/.test(a) ||
    /(^|\/)journeys(\/|$)/.test(a) ||
    /(^|\/)universal(\/|$)/.test(a)
  );
}

/**
 * @param {string} rel
 */
function normalizeRel(rel) {
  return String(rel || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

/**
 * Minimal ** / * glob matcher for discovery unit tests.
 * @param {string} filePath
 * @param {string} pattern
 */
function matchSimpleGlob(filePath, pattern) {
  const g = String(pattern || '');
  let re = '';
  for (let i = 0; i < g.length; i += 1) {
    const ch = g[i];
    if (ch === '*' && g[i + 1] === '*') {
      re += '.*';
      i += 1;
      if (g[i + 1] === '/') {
        // **/ may match zero directories — allow optional slash
        re += '/?';
        i += 1;
      }
      continue;
    }
    if (ch === '*') {
      re += '[^/]*';
      continue;
    }
    if ('\\.[]{}()+-^$|?'.includes(ch)) {
      re += `\\${ch}`;
      continue;
    }
    re += ch;
  }
  return new RegExp(`^${re}$`).test(filePath);
}
