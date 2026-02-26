import prompts from 'prompts';
import pc from 'picocolors';

/**
 * Extract the subdomain (storeKey) from a Shopify domain.
 * "voldt-staging.myshopify.com" → "voldt-staging"
 */
export function extractAlias(domain) {
  return domain.replace(/\.myshopify\.com$/i, '').trim();
}

/**
 * Normalize a store domain input.
 * Appends ".myshopify.com" if not present.
 */
export function normalizeDomain(input) {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.endsWith('.myshopify.com')) return trimmed;
  return `${trimmed}.myshopify.com`;
}

/**
 * Prompt the user for a single store URL + alias pair.
 * Returns { alias, domain } or null if cancelled.
 */
export async function promptStore(defaultDomain = '') {
  const { domain } = await prompts({
    type: 'text',
    name: 'domain',
    message: 'Store URL',
    initial: defaultDomain,
    validate: (v) =>
      v.trim().length > 0 ? true : 'Store URL is required',
  });

  if (!domain) return null;

  const normalized = normalizeDomain(domain);
  const suggestedAlias = extractAlias(normalized);

  const { alias } = await prompts({
    type: 'text',
    name: 'alias',
    message: `Alias`,
    initial: suggestedAlias,
    validate: (v) => {
      const val = v.trim();
      if (!val) return 'Alias is required';
      if (!/^[a-z0-9][a-z0-9-]*$/.test(val)) return 'Alias must be lowercase alphanumeric with hyphens';
      return true;
    },
  });

  if (!alias) return null;

  return { alias: alias.trim(), domain: normalized };
}

/**
 * Prompt the user for one or more stores in a loop.
 * Returns an array of { alias, domain } objects.
 */
export async function promptStoreLoop() {
  const stores = [];

  console.log(pc.cyan('\n  Configure your Shopify store(s)\n'));

  // First store is required
  const first = await promptStore();
  if (!first) {
    console.log(pc.red('  Setup cancelled.'));
    process.exit(1);
  }
  stores.push(first);

  // Ask for more stores
  while (true) {
    const { another } = await prompts({
      type: 'confirm',
      name: 'another',
      message: 'Add another store?',
      initial: false,
    });

    if (!another) break;

    const store = await promptStore();
    if (!store) break;

    if (stores.some((s) => s.alias === store.alias)) {
      console.log(pc.yellow(`  Alias "${store.alias}" already exists, skipping.`));
      continue;
    }

    stores.push(store);
  }

  return stores;
}

/**
 * Ask whether preview + cleanup workflows should be scaffolded.
 */
export async function promptPreviewWorkflows() {
  const { enablePreviewWorkflows } = await prompts({
    type: 'confirm',
    name: 'enablePreviewWorkflows',
    message: 'Enable preview + cleanup workflows?',
    initial: false,
  });

  return !!enablePreviewWorkflows;
}

/**
 * Ask whether build workflows should be scaffolded.
 */
export async function promptBuildWorkflows() {
  const { enableBuildWorkflows } = await prompts({
    type: 'confirm',
    name: 'enableBuildWorkflows',
    message: 'Enable build + Lighthouse workflows?',
    initial: false,
  });

  return !!enableBuildWorkflows;
}

/**
 * Prompt for a single new store (used by add-store command).
 * Takes existing aliases to prevent duplicates.
 */
export async function promptNewStore(existingAliases = []) {
  console.log(pc.cyan('\n  Add a new store\n'));

  const store = await promptStore();
  if (!store) return null;

  if (existingAliases.includes(store.alias)) {
    console.log(pc.red(`  Alias "${store.alias}" already exists.`));
    return null;
  }

  return store;
}
