import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getLatestTagVersion } from './git.js';

const PKG = 'package.json';

/**
 * Resolve absolute path to the target repo's package.json.
 * Defaults to cwd.
 */
function pkgPath(cwd = process.cwd()) {
  return join(cwd, PKG);
}

/**
 * Read the full package.json from a target repo.
 * Returns null if it doesn't exist.
 * @public (used by tests)
 */
export function readPkg(cwd = process.cwd()) {
  const p = pkgPath(cwd);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf-8'));
}

/**
 * Write the full package.json object back to disk.
 */
export function writePkg(pkg, cwd = process.cwd()) {
  writeFileSync(pkgPath(cwd), JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

/**
 * Read the climaybe config section from package.json.
 * Returns null if package.json or config section doesn't exist.
 */
export function readConfig(cwd = process.cwd()) {
  const pkg = readPkg(cwd);
  return pkg?.config ?? null;
}

/**
 * @typedef {object} WriteConfigOptions
 * @property {string} [defaultPackageName] - When creating package.json, set `name` (default: shopify-theme).
 */

/**
 * Write/merge the climaybe config section into package.json.
 * Creates package.json if it doesn't exist.
 * @param {object} config
 * @param {string} [cwd]
 * @param {WriteConfigOptions} [options]
 */
export function writeConfig(config, cwd = process.cwd(), options = {}) {
  const defaultPackageName = options.defaultPackageName ?? 'shopify-theme';
  let pkg = readPkg(cwd);
  if (!pkg) {
    let version = '1.0.0';
    try {
      const fromTags = getLatestTagVersion(cwd);
      if (fromTags) version = fromTags;
    } catch {
      // not a git repo or no tags
    }
    pkg = {
      name: defaultPackageName,
      version,
      private: true,
      config: {},
    };
  }
  pkg.config = { ...pkg.config, ...config };
  writePkg(pkg, cwd);
}

/**
 * Resolved project kind for guards and init flows.
 * - `app` only when config explicitly sets project_type: app.
 * - Otherwise `theme` (including missing config and legacy theme repos without project_type).
 * @param {string} [cwd]
 * @returns {'theme' | 'app'}
 */
export function getProjectType(cwd = process.cwd()) {
  const config = readConfig(cwd);
  if (config?.project_type === 'app') return 'app';
  return 'theme';
}

/**
 * True if this repo is clearly a theme project (explicit project_type or legacy stores).
 * Used to refuse `app init` on theme repos.
 * @param {string} [cwd]
 */
export function isThemeProjectForAppInit(cwd = process.cwd()) {
  const config = readConfig(cwd);
  if (!config) return false;
  if (config.project_type === 'theme') return true;
  if (config.stores && typeof config.stores === 'object' && Object.keys(config.stores).length > 0) {
    return true;
  }
  return false;
}

/**
 * Get the list of store aliases from config.
 */
export function getStoreAliases(cwd = process.cwd()) {
  const config = readConfig(cwd);
  if (!config?.stores) return [];
  return Object.keys(config.stores);
}

/**
 * Determine the current mode: 'single' or 'multi'.
 */
export function getMode(cwd = process.cwd()) {
  const aliases = getStoreAliases(cwd);
  return aliases.length > 1 ? 'multi' : 'single';
}

/**
 * Whether optional preview/cleanup workflows are enabled.
 */
export function isPreviewWorkflowsEnabled(cwd = process.cwd()) {
  const config = readConfig(cwd);
  return config?.preview_workflows === true;
}

/**
 * Whether optional build/Lighthouse workflows are enabled.
 */
export function isBuildWorkflowsEnabled(cwd = process.cwd()) {
  const config = readConfig(cwd);
  return config?.build_workflows === true;
}

/**
 * Whether commitlint + Husky was enabled at init.
 */
export function isCommitlintEnabled(cwd = process.cwd()) {
  const config = readConfig(cwd);
  return config?.commitlint === true;
}

/**
 * Whether bundled Cursor rules + skills were installed (init or add-cursor).
 */
export function isCursorSkillsEnabled(cwd = process.cwd()) {
  const config = readConfig(cwd);
  return config?.cursor_skills === true;
}

/**
 * Add a store entry to the config.
 * Returns the updated config.
 */
export function addStoreToConfig(alias, domain, cwd = process.cwd()) {
  const config = readConfig(cwd) || { port: 9295, stores: {} };
  if (!config.stores) config.stores = {};

  config.stores[alias] = domain;

  // Set as default if it's the first store
  if (!config.default_store) {
    config.default_store = domain;
  }

  writeConfig(config, cwd);
  return readConfig(cwd);
}
