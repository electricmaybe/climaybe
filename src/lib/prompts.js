import prompts from 'prompts';
import pc from 'picocolors';

/**
 * Extract the subdomain (storeKey) from a Shopify domain.
 * "voldt-staging.myshopify.com" → "voldt-staging"
 */
export function extractAlias(domain) {
  return domain.trim().replace(/\.myshopify\.com$/i, '').trim();
}

/**
 * Normalize a store domain input.
 * Appends ".myshopify.com" if not present.
 */
export function normalizeDomain(input) {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\s+/g, '');

  if (!cleaned) return '';
  if (cleaned.endsWith('.myshopify.com')) return cleaned;
  return `${cleaned}.myshopify.com`;
}

/**
 * Validate normalized Shopify store domain format.
 * Expected: "<subdomain>.myshopify.com"
 */
export function isValidShopifyDomain(domain) {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain);
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
    validate: (v) => {
      if (v.trim().length === 0) return 'Store URL is required';
      const normalized = normalizeDomain(v);
      if (!normalized || !isValidShopifyDomain(normalized)) {
        return 'Enter a valid Shopify domain (e.g. voldt-staging.myshopify.com)';
      }
      return true;
    },
  });

  if (!domain) return null;

  const normalized = normalizeDomain(domain);
  if (!isValidShopifyDomain(normalized)) return null;
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

/**
 * Ask which CI host to configure for secrets (after init). Returns 'github' | 'gitlab' | 'skip'.
 */
export async function promptConfigureCISecrets() {
  const { host } = await prompts({
    type: 'select',
    name: 'host',
    message: 'Configure CI secrets / variables now?',
    choices: [
      { title: 'GitHub (gh CLI)', value: 'github' },
      { title: 'GitLab (glab CLI)', value: 'gitlab' },
      { title: 'Skip', value: 'skip' },
    ],
    initial: 0,
  });
  return host ?? 'skip';
}

/**
 * Ask whether to update existing CI secrets (when some are already set). Returns true to update, false to skip.
 */
export async function promptUpdateExistingSecrets(existingNames) {
  const list = existingNames.length <= 5 ? existingNames.join(', ') : `${existingNames.slice(0, 3).join(', ')} and ${existingNames.length - 3} more`;
  const { update } = await prompts({
    type: 'confirm',
    name: 'update',
    message: `You already have ${existingNames.length} secret(s) set (${list}). Update them?`,
    initial: false,
  });
  return !!update;
}

/**
 * Prompt for a single secret value. Shows name, required/optional, description, and where to get it.
 * Returns the value string or null if user skips (optional secrets only).
 */
export async function promptSecretValue(secret, index, total) {
  const requiredLabel = secret.required ? pc.red('required') : pc.dim('optional');
  const message = `[${index + 1}/${total}] ${secret.name} (${requiredLabel})`;

  console.log(pc.cyan(`\n  ${secret.name}`));
  console.log(pc.dim(`  ${secret.description}`));
  console.log(pc.dim(`  Where to get: ${secret.whereToGet}`));

  const { value } = await prompts({
    type: 'password',
    name: 'value',
    message,
    validate: (v) => {
      if (secret.required && !(v && v.trim())) return 'This secret is required for your workflows.';
      return true;
    },
  });

  if (value === undefined) return null;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed && !secret.required) return null;
  return trimmed || null;
}
