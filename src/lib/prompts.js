import prompts from 'prompts';
import pc from 'picocolors';
import { basename } from 'node:path';

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
    message: 'Store name or domain',
    initial: defaultDomain,
    validate: (v) => {
      if (v.trim().length === 0) return 'Store name is required';
      const normalized = normalizeDomain(v);
      if (!normalized || !isValidShopifyDomain(normalized)) {
        return 'Enter a valid store name or domain (e.g. voldt-staging or voldt-staging.myshopify.com)';
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
    initial: true,
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
    message: 'Enable build workflows? (bundle _scripts JS + compile Tailwind in CI)',
    initial: true,
  });

  return !!enableBuildWorkflows;
}

/**
 * Ask whether Liquid performance profile workflows should be scaffolded.
 */
export async function promptProfileWorkflows() {
  const { enableProfileWorkflows } = await prompts({
    type: 'confirm',
    name: 'enableProfileWorkflows',
    message: 'Enable Liquid performance profiling workflows? (TTFB measurement on main)',
    initial: true,
  });

  return !!enableProfileWorkflows;
}

/**
 * Ask whether Lighthouse CI should run as part of the build pipeline.
 * Only meaningful when build workflows are enabled (Lighthouse runs after the build).
 */
export async function promptLighthouseWorkflows() {
  const { enableLighthouseWorkflows } = await prompts({
    type: 'confirm',
    name: 'enableLighthouseWorkflows',
    message: 'Also run Lighthouse CI on the staging branch? (performance + a11y budget)',
    initial: true,
  });

  return !!enableLighthouseWorkflows;
}

/**
 * Ask whether to scaffold local theme dev-kit files (configs, ignores, editor tasks).
 */
export async function promptDevKit() {
  const { enableDevKit } = await prompts({
    type: 'confirm',
    name: 'enableDevKit',
    message:
      'Install Electric Maybe theme dev kit? (local dev config files, ignore defaults, and optional VS Code tasks)',
    initial: true,
  });

  return !!enableDevKit;
}

/**
 * Ask whether to scaffold VS Code tasks for local serve/watch.
 */
export async function promptVSCodeDevTasks() {
  const { enableVSCodeTasks } = await prompts({
    type: 'confirm',
    name: 'enableVSCodeTasks',
    message: 'Add VS Code tasks.json to auto-run climaybe local dev commands (Shopify + assets watch)?',
    initial: true,
  });

  return !!enableVSCodeTasks;
}

/**
 * Ask whether to set up commitlint + Husky (conventional commits enforced on git commit).
 */
export async function promptCommitlint() {
  const { enableCommitlint } = await prompts({
    type: 'confirm',
    name: 'enableCommitlint',
    message: 'Enable commitlint + Husky? (enforce conventional commits on git commit)',
    initial: true,
  });

  return !!enableCommitlint;
}

/**
 * Ask whether to reconcile GitHub branch protection for the configured mode
 * (protect main in single-store, or each live-<alias> in multi-store).
 */
export async function promptBranchProtection() {
  const { enableBranchProtection } = await prompts({
    type: 'confirm',
    name: 'enableBranchProtection',
    message:
      'Set up GitHub branch protection? (require PRs on production branches; needs a GitHub origin + authenticated gh CLI)',
    initial: true,
  });

  return !!enableBranchProtection;
}

/**
 * Ask whether to install the bundled Electric Maybe AI ruleset (rules, skills, subagents)
 * into a single `.config/ai/` source of truth.
 */
export async function promptCursorSkills() {
  const { enableCursorSkills } = await prompts({
    type: 'confirm',
    name: 'enableCursorSkills',
    message: 'Install the Electric Maybe AI ruleset? (rules, skills, subagents in .config/ai/)',
    initial: true,
  });

  return !!enableCursorSkills;
}

/**
 * Ask which editors to bridge to the shared `.config/ai/` ruleset. Returns an array of
 * editor keys understood by EDITOR_BRIDGES in cursor-bundle.js. Defaults to Cursor.
 */
export async function promptAiEditors() {
  const { editors } = await prompts({
    type: 'multiselect',
    name: 'editors',
    message: 'Which editors should read the ruleset? (bridged to .config/ai/, no duplication)',
    instructions: false,
    hint: '- space to toggle, enter to confirm',
    choices: [
      { title: 'Cursor', value: 'cursor', selected: true },
      { title: 'Claude Code (CLAUDE.md)', value: 'claude', selected: true },
      { title: 'GitHub Copilot / VS Code', value: 'copilot', selected: false },
      { title: 'Windsurf', value: 'windsurf', selected: false },
      { title: 'Cline / Roo Code', value: 'cline', selected: false },
      { title: 'Other editors (AGENTS.md)', value: 'agents', selected: false },
    ],
  });

  // `prompts` returns undefined on cancel / non-TTY; fall back to Cursor.
  return Array.isArray(editors) && editors.length > 0 ? editors : ['cursor'];
}

/**
 * Prompt for package.json name when creating a new package.json.
 */
export async function promptProjectName(cwd = process.cwd()) {
  const suggested = basename(cwd).trim().toLowerCase().replace(/\s+/g, '-');
  const { projectName } = await prompts({
    type: 'text',
    name: 'projectName',
    message: 'Project name for package.json',
    initial: suggested || 'shopify-theme',
    validate: (v) => {
      const name = String(v || '').trim();
      if (!name) return 'Project name is required';
      if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
        return 'Use lowercase letters, numbers, dot, underscore, or hyphen';
      }
      return true;
    },
  });
  return String(projectName || '').trim();
}

/**
 * Ask which store to use for local theme dev (multi-store `climaybe serve`).
 * @param {{ aliases: string[]; stores: Record<string, string>; suggestedAlias: string }} opts
 * @returns {Promise<string | null>} Selected alias, or null if cancelled.
 */
export async function promptServeStore({ aliases, stores, suggestedAlias }) {
  const sorted = [...aliases].sort();
  const choices = sorted.map((alias) => ({
    title: `${alias} (${stores[alias]})`,
    value: alias,
  }));
  const initialIndex = sorted.indexOf(suggestedAlias);
  const { alias } = await prompts({
    type: 'select',
    name: 'alias',
    message: 'Which store should we serve?',
    choices,
    initial: initialIndex >= 0 ? initialIndex : 0,
  });
  return alias ?? null;
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
 * When no GitHub/GitLab origin remote exists, ask how to proceed at the CI secrets step.
 * Returns 'add' (prompt for owner/repo and add origin), or 'skip' (do it later).
 */
export async function promptNoRemoteAction(hostName) {
  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: `CI secrets need a ${hostName} repo, but this folder has no "origin" remote. What now?`,
    choices: [
      { title: `Add an ${hostName} remote now and continue`, value: 'add' },
      { title: 'Skip for now (add secrets later in repo settings)', value: 'skip' },
    ],
    initial: 0,
  });
  return action ?? 'skip';
}

/**
 * Prompt for an owner/repo slug to wire up as the git origin remote.
 * Returns a trimmed "owner/repo" string, or null if skipped/invalid.
 */
export async function promptOwnerRepo(hostName) {
  const { slug } = await prompts({
    type: 'text',
    name: 'slug',
    message: `${hostName} repository (owner/repo)`,
    validate: (v) => {
      const s = String(v || '').trim();
      if (!s) return 'Enter owner/repo, or press Esc to skip';
      if (!/^[^/\s]+\/[^/\s]+$/.test(s)) return 'Use the form owner/repo (e.g. electricmaybe/climaybe)';
      return true;
    },
  });
  const s = String(slug || '').trim();
  return /^[^/\s]+\/[^/\s]+$/.test(s) ? s : null;
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

/**
 * Ask whether to test the theme token against the store now. Returns true to test, false to skip.
 */
export async function promptTestThemeToken() {
  const { test } = await prompts({
    type: 'confirm',
    name: 'test',
    message: 'Test this token against the store now?',
    initial: true,
  });
  return !!test;
}
