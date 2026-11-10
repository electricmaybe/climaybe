import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_RULES_PATH = join(__dirname, '..', 'selection-rules.json');

/**
 * @typedef {'small' | 'medium' | 'release'} QaScope
 * @typedef {{
 *   alwaysTags?: string[],
 *   themePaths?: string[],
 *   nonThemeGlobs?: string[],
 *   releasePathGlobs?: string[],
 *   scopes?: Record<string, { maxThemeFiles?: number, viewports?: string[], fullSuite?: boolean }>,
 *   rules?: Array<{
 *     id: string,
 *     globs: string[],
 *     tags: string[],
 *     manual?: string[],
 *     forceViewports?: string[],
 *     forceScope?: QaScope
 *   }>,
 *   implications?: Array<{ provenBy: string, skips: string[] }>,
 *   gatekeepers?: Array<{ id: string, tags: string[], blocksAll?: boolean, blocks?: string[] }>
 * }} SelectionRules
 */

/**
 * Convert a simple glob (prefix *, suffix *, or substring *) to RegExp.
 * @param {string} glob
 */
export function globToRegExp(glob) {
  const g = String(glob || '');
  let re = '';
  for (let i = 0; i < g.length; i += 1) {
    const ch = g[i];
    if (ch === '*') {
      re += '.*';
    } else if ('\\.[]{}()+-^$|?'.includes(ch)) {
      re += `\\${ch}`;
    } else {
      re += ch;
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * @param {string} filePath
 * @param {string} glob
 */
export function pathMatchesGlob(filePath, glob) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const g = String(glob || '').replace(/\\/g, '/');

  if (g.endsWith('/') && !g.includes('*')) {
    return normalized === g.slice(0, -1) || normalized.startsWith(g);
  }
  if (!g.includes('*')) {
    return normalized === g || normalized.startsWith(`${g}/`) || normalized.endsWith(`/${g}`) || normalized.includes(`/${g}/`);
  }
  return globToRegExp(g).test(normalized) || globToRegExp(`**/${g}`).test(normalized);
}

/**
 * @param {string} [rulesPath]
 * @returns {SelectionRules}
 */
export function loadSelectionRules(rulesPath = DEFAULT_RULES_PATH) {
  return JSON.parse(readFileSync(rulesPath, 'utf-8'));
}

/**
 * @param {string[]} changedFiles
 * @param {SelectionRules} rules
 */
export function isThemeFile(filePath, rules) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  for (const skip of rules.nonThemeGlobs || []) {
    if (pathMatchesGlob(normalized, skip) || normalized.startsWith(skip)) return false;
  }
  for (const theme of rules.themePaths || []) {
    if (pathMatchesGlob(normalized, theme) || normalized.startsWith(theme)) return true;
  }
  // Fallback: treat liquid/json/css/js under theme-ish roots as theme
  return /\.(liquid|css|js|json)$/.test(normalized) && !normalized.startsWith('tests/');
}

/**
 * @param {string[]} changedFiles
 * @param {SelectionRules} [rules]
 * @param {{ baseBranch?: string, headBranch?: string, forceRelease?: boolean }} [opts]
 */
export function selectTests(changedFiles, rules = loadSelectionRules(), opts = {}) {
  const files = (changedFiles || []).map((f) => String(f).replace(/\\/g, '/'));
  const themeFiles = files.filter((f) => isThemeFile(f, rules));
  const matchedRuleIds = new Set();
  const tags = new Set(rules.alwaysTags || ['@funnel', '@purchase']);
  const manualIds = new Set();
  /** @type {QaScope | null} */
  let forcedScope = null;
  /** @type {string[] | null} */
  let forcedViewports = null;

  for (const file of themeFiles) {
    for (const rule of rules.rules || []) {
      const hit = (rule.globs || []).some((g) => pathMatchesGlob(file, g));
      if (!hit) continue;
      matchedRuleIds.add(rule.id);
      for (const t of rule.tags || []) tags.add(t);
      for (const m of rule.manual || []) manualIds.add(m);
      if (rule.forceScope === 'release' || rule.forceScope === 'medium' || rule.forceScope === 'small') {
        if (!forcedScope || scopeRank(rule.forceScope) > scopeRank(forcedScope)) {
          forcedScope = rule.forceScope;
        }
      }
      if (Array.isArray(rule.forceViewports) && rule.forceViewports.length) {
        forcedViewports = mergeViewports(forcedViewports, rule.forceViewports);
      }
    }
  }

  const scope = resolveScope(themeFiles, rules, {
    ...opts,
    forcedScope,
  });
  const scopeDef = rules.scopes?.[scope] || {};
  let viewports = forcedViewports || scopeDef.viewports || ['mobile', 'desktop'];
  if (scope === 'release' || scopeDef.fullSuite) {
    viewports = ['mobile', 'tablet', 'desktop'];
  }

  const fullSuite = scope === 'release' || !!scopeDef.fullSuite;
  if (fullSuite) {
    for (const rule of rules.rules || []) {
      matchedRuleIds.add(rule.id);
      for (const t of rule.tags || []) tags.add(t);
      for (const m of rule.manual || []) manualIds.add(m);
    }
  }

  // Always keep purchase funnel
  tags.add('@funnel');
  tags.add('@purchase');

  const tagList = [...tags].sort();
  const grep = tagList.map(escapeRegexLiteral).join('|');

  return {
    scope,
    themeFileCount: themeFiles.length,
    changedThemeFiles: themeFiles,
    matchedRules: [...matchedRuleIds].sort(),
    tags: tagList,
    grep,
    viewports,
    fullSuite,
    manualIds: [...manualIds].sort(),
    browserProjects: viewportsToProjects(viewports),
    // No theme changes → no Shopify preview; CI skips green.
    // Theme-changing PRs always run the purchase funnel (never skip browsers for those).
    skipBrowser: themeFiles.length === 0,
  };
}

/**
 * Fail-closed CI fallback when `store-qa select` itself fails.
 * Uses the true release / fullSuite union from selection rules (all rule tags,
 * three viewports, all manual ids) — never a funnel-only stub, never skipBrowser.
 *
 * @param {{
 *   rules?: SelectionRules,
 *   baseBranch?: string,
 *   headBranch?: string,
 * }} [opts]
 */
export function buildFailClosedFullSuiteSelection(opts = {}) {
  const rules = opts.rules || loadSelectionRules();
  // layout/theme.liquid is a releasePathGlob + layout-head forceScope=release trigger;
  // forceRelease makes the scope unambiguous even if rules drift.
  const selection = selectTests(['layout/theme.liquid'], rules, {
    forceRelease: true,
    baseBranch: opts.baseBranch,
    headBranch: opts.headBranch,
  });
  return {
    ...selection,
    skipBrowser: false,
    themeFileCount: Math.max(Number(selection.themeFileCount) || 0, 1),
    fullSuite: true,
    scope: 'release',
    selectionFailed: true,
    changedThemeFiles: ['(selection-failed-full-suite)'],
  };
}

/**
 * @param {QaScope} scope
 */
function scopeRank(scope) {
  if (scope === 'release') return 3;
  if (scope === 'medium') return 2;
  return 1;
}

/**
 * @param {string[] | null} a
 * @param {string[]} b
 */
function mergeViewports(a, b) {
  const order = ['mobile', 'tablet', 'desktop'];
  const set = new Set([...(a || []), ...b]);
  return order.filter((v) => set.has(v));
}

/**
 * @param {string[]} themeFiles
 * @param {SelectionRules} rules
 * @param {{ baseBranch?: string, headBranch?: string, forceRelease?: boolean, forcedScope?: QaScope | null }} opts
 * @returns {QaScope}
 */
export function resolveScope(themeFiles, rules, opts = {}) {
  if (opts.forceRelease) return 'release';
  if (opts.forcedScope) return opts.forcedScope;

  const base = String(opts.baseBranch || '');
  const head = String(opts.headBranch || '');
  // Classic release PR shapes
  if (
    (head === 'staging' && base === 'main') ||
    /^staging-.+/.test(head) && /^live-.+/.test(base) ||
    (head === 'main' && /^live-/.test(base))
  ) {
    return 'release';
  }

  for (const file of themeFiles) {
    for (const g of rules.releasePathGlobs || []) {
      if (pathMatchesGlob(file, g) || file.startsWith(g)) return 'release';
    }
  }

  const count = themeFiles.length;
  const smallMax = rules.scopes?.small?.maxThemeFiles ?? 5;
  const mediumMax = rules.scopes?.medium?.maxThemeFiles ?? 30;
  if (count <= smallMax) return 'small';
  if (count <= mediumMax) return 'medium';
  return 'release';
}

/**
 * @param {string[]} viewports
 */
export function viewportsToProjects(viewports) {
  const map = {
    mobile: 'mobile-webkit',
    tablet: 'tablet-webkit',
    desktop: 'desktop-chromium',
  };
  return (viewports || []).map((v) => map[v] || v);
}

/**
 * Given failed gatekeeper tags, return tags that should be marked blocked (not failed).
 * @param {string[]} failedTags
 * @param {SelectionRules} [rules]
 */
export function blockedTagsForFailures(failedTags, rules = loadSelectionRules()) {
  const failed = new Set(failedTags || []);
  const blocked = new Set();
  for (const gk of rules.gatekeepers || []) {
    const hit = (gk.tags || []).some((t) => failed.has(t));
    if (!hit) continue;
    if (gk.blocksAll) {
      blocked.add('*');
      continue;
    }
    for (const t of gk.blocks || []) blocked.add(t);
  }
  return [...blocked];
}

/**
 * Tags that can be skipped because a later step already proved them.
 * @param {string[]} provenTags
 * @param {SelectionRules} [rules]
 */
export function skippedByImplication(provenTags, rules = loadSelectionRules()) {
  const proven = new Set(provenTags || []);
  const skips = new Set();
  for (const rule of rules.implications || []) {
    if (proven.has(rule.provenBy)) {
      for (const s of rule.skips || []) skips.add(s);
    }
  }
  return [...skips];
}

function escapeRegexLiteral(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
