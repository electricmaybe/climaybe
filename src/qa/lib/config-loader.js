import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseYamlLite } from './yaml-lite.js';

/**
 * Load theme-repo qa/config.yml (or .json).
 * @param {string} [cwd]
 */
export function loadQaConfig(cwd = process.cwd()) {
  const yml = join(cwd, 'qa', 'config.yml');
  const yaml = join(cwd, 'qa', 'config.yaml');
  const json = join(cwd, 'qa', 'config.json');
  if (existsSync(yml)) return { path: yml, config: parseYamlLite(readFileSync(yml, 'utf-8')) };
  if (existsSync(yaml)) return { path: yaml, config: parseYamlLite(readFileSync(yaml, 'utf-8')) };
  if (existsSync(json)) return { path: json, config: JSON.parse(readFileSync(json, 'utf-8')) };
  return { path: null, config: null };
}

/**
 * Resolve sample product / collection paths for a store alias.
 * @param {object} config
 * @param {string} [storeAlias]
 */
export function resolveStoreFixtures(config, storeAlias) {
  const stores = Array.isArray(config?.stores) ? config.stores : [];
  let store = null;
  if (storeAlias) {
    store = stores.find((s) => s?.alias === storeAlias) || null;
  }
  if (!store) store = stores[0] || null;

  const products = { ...(config?.products || {}), ...(store?.products || {}) };
  const collections = { ...(config?.collections || {}), ...(store?.collections || {}) };
  const viewports = config?.viewports || ['mobile', 'tablet', 'desktop'];
  const features = config?.features || {};
  const baseBranches = config?.base_branches || null;

  // Soft-pass variant change only when config explicitly says the product has no variants.
  const hasVariants = !(products.has_variants === false || features.variants === false);

  return {
    store,
    alias: store?.alias || storeAlias || 'default',
    previewBase: store?.preview_base || config?.preview_base || null,
    productPath: products.sample || products.default || '/products/',
    soldOutPath: products.sold_out || null,
    variantProductPath: products.with_variants || products.sample || products.default || null,
    hasVariants,
    collectionPath: collections.sample || collections.default || '/collections/all',
    contactPath: features.contact_path || '/pages/contact',
    viewports,
    features,
    baseBranches,
    thirdPartyAllowlist: config?.console_allowlist || [
      'klaviyo',
      'swym',
      'etrusted',
      'clarity',
      'googletagmanager',
      'google-analytics',
      'youtube',
      'shopifycloud',
      'cdn.shopify.com/s/files',
    ],
  };
}

/**
 * Whether store QA should run for this PR base branch, given climaybe + qa config.
 * @param {string} baseBranch
 * @param {{ mode?: 'single' | 'multi', qaConfig?: object, climaybeConfig?: object }} opts
 */
export function shouldRunForBaseBranch(baseBranch, opts = {}) {
  const base = String(baseBranch || '');
  const fromQa = opts.qaConfig?.base_branches;
  if (Array.isArray(fromQa) && fromQa.length) {
    return fromQa.some((pattern) => matchBranchPattern(base, pattern));
  }
  const fromClimaybe = opts.climaybeConfig?.store_qa_base_branches;
  if (Array.isArray(fromClimaybe) && fromClimaybe.length) {
    return fromClimaybe.some((pattern) => matchBranchPattern(base, pattern));
  }
  // Defaults: multi → live-*; single → main
  if (opts.mode === 'multi') return base.startsWith('live-');
  return base === 'main';
}

/**
 * @param {string} branch
 * @param {string} pattern  e.g. main, live-*, live-euro
 */
export function matchBranchPattern(branch, pattern) {
  const b = String(branch || '');
  const p = String(pattern || '');
  if (p.endsWith('*')) return b.startsWith(p.slice(0, -1));
  return b === p;
}
