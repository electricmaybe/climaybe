import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { isHarnessEnabled, readConfig, readPkg, writeConfig } from './config.js';
import { isGitRepo } from './git.js';
import { AI_RULES_ENTRY } from './cursor-bundle.js';

export { isHarnessEnabled };

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = join(__dirname, '..', 'harness', 'theme');

/** Minimum Node for Shopify CLI 4.8.5 (documented in generated init.sh). */
export const HARNESS_MIN_NODE = { major: 22, minor: 12 };

const HARNESS_FILES = [
  { relativePath: 'AGENTS.md', template: 'AGENTS.md', mode: 0o644 },
  { relativePath: 'CLAUDE.md', template: 'CLAUDE.md', mode: 0o644 },
  {
    relativePath: '.config/ai/rules/agent-harness.mdc',
    template: 'agent-harness.mdc',
    mode: 0o644,
  },
  { relativePath: 'init.sh', template: 'init.sh', mode: 0o755 },
  { relativePath: 'feature_list.json', template: 'feature_list.json', mode: 0o644 },
  { relativePath: 'progress.md', template: 'progress.md', mode: 0o644 },
  { relativePath: 'session-handoff.md', template: 'session-handoff.md', mode: 0o644 },
  { relativePath: 'docs/harness/DIGEST.md', template: 'DIGEST.md', mode: 0o644 },
];

/**
 * Plain {{KEY}} substitution. Unknown keys are left untouched.
 * @param {string} template
 * @param {Record<string, string>} values
 */
export function renderTemplate(template, values) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
    return match;
  });
}

/**
 * Resolve display name: package.json name, else folder name.
 * @param {string} [cwd]
 */
export function resolveThemeName(cwd = process.cwd()) {
  const pkg = readPkg(cwd);
  const fromPkg = typeof pkg?.name === 'string' ? pkg.name.trim() : '';
  if (fromPkg) return fromPkg;
  const folder = basename(cwd).trim();
  return folder || 'shopify-theme';
}

/**
 * Normalize symlink target to a repo-relative posix-ish path for comparison.
 * @param {string} cwd
 * @param {string} linkPath
 */
function readSymlinkTargetRel(cwd, linkPath) {
  try {
    if (!lstatSync(linkPath).isSymbolicLink()) return null;
    const raw = readlinkSync(linkPath);
    // Resolve relative to the link's directory, then make cwd-relative.
    const abs = join(dirname(linkPath), raw);
    return relative(cwd, abs).split('\\').join('/');
  } catch {
    return null;
  }
}

/**
 * True when path is a Climaybe bridge symlink to `.config/ai/rules.md`.
 * @param {string} cwd
 * @param {string} relativePath
 */
export function isClimaybeRulesBridge(cwd, relativePath) {
  const linkPath = join(cwd, relativePath);
  if (!existsSync(linkPath) && !existsSync(dirname(linkPath))) return false;
  try {
    if (!lstatSync(linkPath).isSymbolicLink()) return false;
  } catch {
    return false;
  }
  const target = readSymlinkTargetRel(cwd, linkPath);
  if (!target) return false;
  const normalized = target.replace(/^\.\//, '');
  return normalized === AI_RULES_ENTRY || normalized === '.config/ai/rules.md';
}

/**
 * Build substitution values from climaybe.config.json + package.json.
 * @param {string} [cwd]
 * @param {{ climaybeVersion?: string, date?: string }} [opts]
 */
export function buildHarnessValues(cwd = process.cwd(), opts = {}) {
  const config = readConfig(cwd) || {};
  const stores = config.stores && typeof config.stores === 'object' ? config.stores : {};
  const aliases = Object.keys(stores);
  const mode = aliases.length > 1 ? 'multi' : 'single';
  const baseBranch =
    typeof config.base_branch === 'string' && config.base_branch.trim()
      ? config.base_branch.trim()
      : 'staging';
  const devStore =
    (typeof config.dev_store === 'string' && config.dev_store.trim()) ||
    (typeof config.default_store === 'string' && config.default_store.trim()) ||
    (aliases[0] ? String(stores[aliases[0]]) : '(not set)');
  const linearTeam =
    typeof config.linear_team === 'string' && config.linear_team.trim()
      ? config.linear_team.trim()
      : '(not set)';

  const storeRows =
    aliases.length === 0
      ? '| (none) | (none) |'
      : aliases.map((alias) => `| \`${alias}\` | \`${stores[alias]}\` |`).join('\n');
  const storesTable = `| Alias | Domain |\n|---|---|\n${storeRows}`;

  let branchFlow;
  let productionBranches;
  if (mode === 'single') {
    branchFlow = `- Single-store flow: \`${baseBranch} -> main\`.\n- Base branch for day-to-day work: \`${baseBranch}\`.`;
    productionBranches = '`main`';
  } else {
    const stagingLive = aliases
      .map((a) => `\`${baseBranch}-${a}\` → \`live-${a}\``)
      .join(', ');
    branchFlow = [
      `- Multi-store flow: \`${baseBranch} -> main -> staging-<alias> -> live-<alias>\`.`,
      `- Base branch for shared work: \`${baseBranch}\`.`,
      `- Per-store branches: ${stagingLive}.`,
    ].join('\n');
    productionBranches = aliases.map((a) => `\`live-${a}\``).join(', ') || '`main`';
  }

  let multiStoreSection = '';
  if (mode === 'multi') {
    const aliasList = aliases.map((a) => `- \`${a}\` → \`${stores[a]}\``).join('\n');
    multiStoreSection = [
      '## Multi-store',
      '',
      'This theme has 2+ stores. Root JSON layouts are per-store under `stores/<alias>/`.',
      '',
      aliasList,
      '',
      '### Sync rules',
      '',
      '- Use `climaybe switch <alias>` to copy `stores/<alias>/` JSON to the repo root and set `default_store`.',
      '- Use `climaybe sync [alias]` to write root JSON back into `stores/<alias>/`.',
      '- Do not hand-edit only one side of the root ↔ `stores/<alias>/` pair without syncing.',
      '- On `staging-<alias>` / `live-<alias>` branches, serve/preview should target that alias’s store.',
      '',
    ].join('\n');
  }

  const ciParts = [];
  if (config.preview_workflows === true) {
    ciParts.push(
      '- **Preview workflows** enabled: PR previews publish development themes; use `skip-preview` label or `[skip-preview]` when a theme push is not needed.'
    );
  } else {
    ciParts.push('- Preview workflows: disabled in config.');
  }
  if (config.build_workflows === true) {
    ciParts.push(
      '- **Build workflows** enabled: push compiles `_scripts` / Tailwind via the build pipeline (respect `paths-ignore`).'
    );
  } else {
    ciParts.push('- Build workflows: disabled in config.');
  }
  if (config.lighthouse_workflows === true) {
    ciParts.push('- **Lighthouse CI** enabled inside the build pipeline when secrets are present.');
  }
  if (config.profile_workflows === true) {
    ciParts.push('- **Liquid performance profiling** enabled on pushes to `main`.');
  }
  if (config.linear_workflows === true) {
    ciParts.push(
      `- **Linear status sync** enabled${linearTeam !== '(not set)' ? ` (team \`${linearTeam}\`)` : ''}. Never store \`LINEAR_API_KEY\` in git.`
    );
  }
  if (ciParts.length === 0) {
    ciParts.push('- No optional CI packages flagged in `climaybe.config.json`.');
  }

  const climaybeVersion =
    opts.climaybeVersion ||
    process.env.CLIMAYBE_PACKAGE_VERSION ||
    readClimaybePackageVersion();
  const date =
    opts.date ||
    new Date().toISOString().slice(0, 10);

  return {
    THEME_NAME: resolveThemeName(cwd),
    MODE: mode,
    BASE_BRANCH: baseBranch,
    DEV_STORE: devStore,
    LINEAR_TEAM: linearTeam,
    STORES_TABLE: storesTable,
    BRANCH_FLOW: branchFlow,
    PRODUCTION_BRANCHES: productionBranches,
    MULTI_STORE_SECTION: multiStoreSection,
    CI_NOTES: ciParts.join('\n'),
    CLIMAYBE_VERSION: climaybeVersion,
    GENERATED_DATE: date,
  };
}

function readClimaybePackageVersion() {
  try {
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Whether an existing path should be left alone (skip create).
 * Climaybe rules.md bridge symlinks for AGENTS.md / CLAUDE.md are replaceable by harness.
 * @param {string} cwd
 * @param {string} relativePath
 */
function shouldSkipExisting(cwd, relativePath) {
  const full = join(cwd, relativePath);
  try {
    lstatSync(full);
  } catch {
    return false;
  }
  if (
    (relativePath === 'AGENTS.md' || relativePath === 'CLAUDE.md') &&
    isClimaybeRulesBridge(cwd, relativePath)
  ) {
    return false;
  }
  return true;
}

/**
 * Replace a rules.md bridge symlink with harness content (file write).
 * @param {string} fullPath
 * @param {string} content
 * @param {number} mode
 */
function writeHarnessFile(fullPath, content, mode) {
  mkdirSync(dirname(fullPath), { recursive: true });
  try {
    if (lstatSync(fullPath).isSymbolicLink()) {
      rmSync(fullPath, { force: true });
    }
  } catch {
    // nothing to remove
  }
  // Atomic-ish write
  const tmp = `${fullPath}.climaybe-tmp`;
  writeFileSync(tmp, content, 'utf-8');
  try {
    renameSync(tmp, fullPath);
  } catch {
    writeFileSync(fullPath, content, 'utf-8');
    try {
      rmSync(tmp, { force: true });
    } catch {
      // ignore
    }
  }
  try {
    chmodSync(fullPath, mode);
  } catch {
    // Windows may ignore mode bits
  }
}

/**
 * Scaffold harness files. Never overwrites real existing files (except Climaybe
 * AGENTS.md/CLAUDE.md symlinks that still point at `.config/ai/rules.md`).
 *
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.markEnabled] - write `harness: true` into config when scaffolding
 * @param {string} [options.climaybeVersion]
 * @param {string} [options.date]
 * @returns {{ created: string[], skipped: string[], warnings: string[], values: Record<string, string> }}
 */
export function scaffoldHarness({
  cwd = process.cwd(),
  dryRun = false,
  markEnabled = true,
  climaybeVersion,
  date,
} = {}) {
  const warnings = [];
  const created = [];
  const skipped = [];

  if (!existsSync(join(cwd, 'package.json'))) {
    warnings.push('No package.json found — theme name taken from folder; init.sh will SKIP npm steps.');
  }
  if (!isGitRepo(cwd)) {
    warnings.push('Not a git repository — harness files will still be written (no git init).');
  }

  const values = buildHarnessValues(cwd, { climaybeVersion, date });

  for (const file of HARNESS_FILES) {
    const full = join(cwd, file.relativePath);
    if (shouldSkipExisting(cwd, file.relativePath)) {
      skipped.push(file.relativePath);
      continue;
    }
    const templatePath = join(TEMPLATE_ROOT, file.template);
    const raw = readFileSync(templatePath, 'utf-8');
    const content = renderTemplate(raw, values);
    if (dryRun) {
      created.push(file.relativePath);
      continue;
    }
    writeHarnessFile(full, content, file.mode);
    created.push(file.relativePath);
  }

  if (!dryRun && markEnabled) {
    writeConfig({ harness: true }, cwd);
  }

  return { created, skipped, warnings, values };
}

/**
 * Log scaffoldHarness() result.
 * @param {ReturnType<typeof scaffoldHarness>} result
 * @param {{ dryRun?: boolean }} [opts]
 */
export function logHarnessResult(result, { dryRun = false } = {}) {
  for (const w of result.warnings) {
    console.log(pc.yellow(`  ${w}`));
  }
  if (result.created.length > 0) {
    console.log(pc.green(`  ${dryRun ? 'Would create' : 'Created'}:`));
    for (const f of result.created) console.log(pc.green(`    + ${f}`));
  } else {
    console.log(pc.dim(`  ${dryRun ? 'Would create nothing' : 'Nothing created'} (all present).`));
  }
  if (result.skipped.length > 0) {
    console.log(pc.dim('  Skipped (already exist):'));
    for (const f of result.skipped) console.log(pc.dim(`    · ${f}`));
  }
}

export { HARNESS_FILES, TEMPLATE_ROOT };
