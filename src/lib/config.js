import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
 * Write/merge the climaybe config section into package.json.
 * Creates package.json if it doesn't exist.
 */
export function writeConfig(config, cwd = process.cwd()) {
  let pkg = readPkg(cwd);
  if (!pkg) {
    pkg = {
      name: 'shopify-theme',
      version: '1.0.0',
      private: true,
      config: {},
    };
  }
  pkg.config = { ...pkg.config, ...config };
  writePkg(pkg, cwd);
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
