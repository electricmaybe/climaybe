import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { getLatestTagVersion } from './git.js';

const PKG = 'package.json';
const CLIMAYBE_CONFIG = 'climaybe.config.json';
const LEGACY_CLIMAYBE_DIR = '.climaybe';
const LEGACY_CLIMAYBE_CONFIG = 'config.json';

/**
 * Resolve absolute path to root climaybe config file.
 */
function climaybeConfigPath(cwd = process.cwd()) {
  return join(cwd, CLIMAYBE_CONFIG);
}

function legacyClimaybeConfigPath(cwd = process.cwd()) {
  return join(cwd, LEGACY_CLIMAYBE_DIR, LEGACY_CLIMAYBE_CONFIG);
}

/**
 * Resolve absolute path to the target repo's package.json.
 * Defaults to cwd.
 */
function pkgPath(cwd = process.cwd()) {
  return join(cwd, PKG);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

/**
 * Read the full package.json from a target repo.
 * Returns null if it doesn't exist.
 * @public (used by tests)
 */
export function readPkg(cwd = process.cwd()) {
  const p = pkgPath(cwd);
  if (!existsSync(p)) return null;
  return readJson(p);
}

/**
 * Write the full package.json object back to disk.
 */
export function writePkg(pkg, cwd = process.cwd()) {
  writeJson(pkgPath(cwd), pkg);
}

/**
 * Read the climaybe config from root file (with legacy fallback).
 * Returns null if neither exists.
 */
export function readClimaybeConfig(cwd = process.cwd()) {
  const p = climaybeConfigPath(cwd);
  if (existsSync(p)) return readJson(p);
  const legacy = legacyClimaybeConfigPath(cwd);
  if (existsSync(legacy)) return readJson(legacy);
  return null;
}

/**
 * Write/merge climaybe config into root config file.
 */
export function writeClimaybeConfig(config, cwd = process.cwd()) {
  const current = readClimaybeConfig(cwd) || {};
  const next = { ...current, ...config };
  writeJson(climaybeConfigPath(cwd), next);
}

/**
 * Read the climaybe config (source of truth).
 * - Primary: climaybe.config.json
 * - Back-compat: .climaybe/config.json
 * - Legacy fallback: package.json → config
 */
export function readConfig(cwd = process.cwd()) {
  const cfg = readClimaybeConfig(cwd);
  if (cfg) return cfg;
  const pkg = readPkg(cwd);
  return pkg?.config ?? null;
}

/**
 * @typedef {object} WriteConfigOptions
 * @property {string} [defaultPackageName] - When creating package.json, set `name` (default: shopify-theme).
 * @property {boolean} [alsoWriteLegacyPackageConfig] - Also write package.json config (default: false).
 */

/**
 * Write/merge the climaybe config (source of truth: climaybe.config.json).
 * Optionally writes legacy package.json config for transitional repos.
 * @param {object} config
 * @param {string} [cwd]
 * @param {WriteConfigOptions} [options]
 */
export function writeConfig(config, cwd = process.cwd(), options = {}) {
  const defaultPackageName = options.defaultPackageName ?? 'shopify-theme';
  const alsoWriteLegacyPackageConfig = options.alsoWriteLegacyPackageConfig ?? false;

  writeClimaybeConfig(config, cwd);

  if (!alsoWriteLegacyPackageConfig) return;

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
 * Migrate legacy package.json config into climaybe.config.json.
 * Returns true if migration wrote a config file.
 */
export function migrateLegacyPackageConfigToClimaybe({ cwd = process.cwd(), overwrite = false } = {}) {
  const legacy = readPkg(cwd)?.config ?? null;
  if (!legacy || typeof legacy !== 'object') return false;

  const existing = readClimaybeConfig(cwd);
  if (existing && !overwrite) return false;

  writeJson(climaybeConfigPath(cwd), legacy);
  return true;
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
 * Whether optional Liquid performance profile workflows are enabled.
 */
export function isProfileWorkflowsEnabled(cwd = process.cwd()) {
  const config = readConfig(cwd);
  return config?.profile_workflows === true;
}

/**
 * Whether bundled Cursor rules, skills, and subagents were installed (init or add-cursor).
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
