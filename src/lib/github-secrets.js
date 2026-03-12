import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import pc from 'picocolors';

/**
 * Secret/variable definitions for CI (GitHub Actions or GitLab CI).
 * condition: 'always' = required for core workflows; 'preview' | 'build' = only when that feature is enabled.
 */
export const SECRET_DEFINITIONS = [
  {
    name: 'GEMINI_API_KEY',
    required: true,
    condition: 'always',
    description: 'Google Gemini API key for AI-generated changelogs on release',
    whereToGet:
      'Google AI Studio: https://aistudio.google.com/apikey — create an API key, then paste it here.',
  },
  {
    name: 'SHOPIFY_STORE_URL',
    required: false,
    condition: 'preview_or_build',
    description: 'Shopify store URL (e.g. your-store.myshopify.com) — preview themes and/or Lighthouse',
    whereToGet:
      'Your theme’s store URL in Shopify Admin → Settings → Domains, or use the .myshopify.com URL.',
  },
  {
    name: 'SHOPIFY_CLI_THEME_TOKEN',
    required: false,
    condition: 'preview',
    description: 'Theme access token so CI can push preview themes to your store',
    whereToGet:
      'Shopify Partners: your app → Theme library access → Create theme access token. Or: Shopify Admin → Apps → Develop apps → your app → API credentials → Theme access.',
  },
  {
    name: 'SHOP_ACCESS_TOKEN',
    required: false,
    condition: 'build',
    description: 'Store API access token for Lighthouse runs',
    whereToGet:
      'Shopify Admin → Settings → Apps and sales channels → Develop apps → your app → API credentials (Admin API or custom app with storefront/build access).',
  },
  {
    name: 'LHCI_GITHUB_APP_TOKEN',
    required: false,
    condition: 'build',
    description: 'Lighthouse CI GitHub App token for posting results as PR comments',
    whereToGet:
      'Lighthouse CI GitHub App: https://github.com/apps/lighthouse-ci — install and create a token, or use a Personal Access Token with repo scope.',
  },
  {
    name: 'SHOP_PASSWORD',
    required: false,
    condition: 'build',
    description: 'Store password if your storefront is password-protected (optional)',
    whereToGet: 'The password visitors enter to access your store (Storefront password in Shopify Admin).',
  },
];

/**
 * Check if GitHub CLI is installed and authenticated.
 */
export function isGhAvailable() {
  try {
    execSync('gh auth status', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the current repo has a GitHub remote (origin pointing to github.com).
 */
export function hasGitHubRemote(cwd = process.cwd()) {
  try {
    const url = execSync('git remote get-url origin', { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
    return /github\.com/i.test(url);
  } catch {
    return false;
  }
}

/**
 * List repository secret names (GitHub). Returns [] on error or if none.
 */
export function listGitHubSecrets(cwd = process.cwd()) {
  try {
    const out = execSync('gh secret list --json name', { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
    const data = JSON.parse(out || '[]');
    return Array.isArray(data) ? data.map((s) => s.name).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * List project CI/CD variable names (GitLab). Returns [] on error or if none.
 */
export function listGitLabVariables(cwd = process.cwd()) {
  try {
    const out = execSync('glab variable list -F json', { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
    const data = JSON.parse(out || '[]');
    if (!Array.isArray(data)) return [];
    return data.map((v) => v.key ?? v.name ?? v.Key).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Set a repository secret via gh CLI. Value is passed via stdin to avoid argv exposure.
 */
export function setSecret(name, value) {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', ['secret', 'set', name], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`gh secret set exited with ${code}`))));
    child.stdin.write(value, (err) => {
      if (err) reject(err);
      else child.stdin.end();
    });
  });
}

/**
 * Check if GitLab CLI is installed and authenticated.
 */
export function isGlabAvailable() {
  try {
    execSync('glab auth status', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the current repo has a GitLab remote (origin pointing to gitlab.com or common self-hosted hosts).
 */
export function hasGitLabRemote(cwd = process.cwd()) {
  try {
    const url = execSync('git remote get-url origin', { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
    return /gitlab\.com|gitlab\./i.test(url);
  } catch {
    return false;
  }
}

/**
 * Set a project CI/CD variable via glab CLI. Value is passed via stdin to avoid argv exposure.
 */
export function setGitLabVariable(name, value) {
  return new Promise((resolve, reject) => {
    const child = spawn('glab', ['variable', 'set', name, '--masked'], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`glab variable set exited with ${code}`))
    );
    child.stdin.write(value, (err) => {
      if (err) reject(err);
      else child.stdin.end();
    });
  });
}

/**
 * Convert store alias to secret suffix (e.g. voldt-norway → VOLDT_NORWAY).
 */
export function aliasToSecretSuffix(alias) {
  return String(alias).replace(/-/g, '_').toUpperCase();
}

/**
 * Get secrets to prompt for based on init choices and store list.
 * For multi-store + preview we return per-store SHOPIFY_STORE_URL_<ALIAS> and SHOPIFY_CLI_THEME_TOKEN_<ALIAS>
 * instead of a single SHOPIFY_STORE_URL / SHOPIFY_CLI_THEME_TOKEN so each branch (staging-<store>, live-<store>) uses the right store.
 */
export function getSecretsToPrompt({ enablePreviewWorkflows, enableBuildWorkflows, mode = 'single', stores = [] }) {
  const isMulti = mode === 'multi' && stores.length > 1;

  const base = SECRET_DEFINITIONS.filter((s) => {
    if (s.condition === 'always') return true;
    if (s.condition === 'preview_or_build') return enablePreviewWorkflows || enableBuildWorkflows;
    if (s.condition === 'preview' && enablePreviewWorkflows) return true;
    if (s.condition === 'build' && enableBuildWorkflows) return true;
    return false;
  });

  // Remove generic SHOPIFY_STORE_URL / SHOPIFY_CLI_THEME_TOKEN when multi-store + preview; we'll add per-store entries
  const dropPreviewGeneric =
    isMulti && enablePreviewWorkflows
      ? (s) => s.name !== 'SHOPIFY_STORE_URL' && s.name !== 'SHOPIFY_CLI_THEME_TOKEN'
      : () => true;

  let list = base.filter(dropPreviewGeneric);

  // Multi-store + preview: add per-store URL and token so staging-<store> / live-<store> use the right store
  if (isMulti && enablePreviewWorkflows) {
    const perStore = [];
    for (const store of stores) {
      const suffix = aliasToSecretSuffix(store.alias);
      perStore.push(
        {
          name: `SHOPIFY_STORE_URL_${suffix}`,
          required: false,
          description: `Store ${store.alias}: Shopify store URL (staging/live use this for ${store.alias})`,
          whereToGet:
            'Shopify Admin → Settings → Domains for this store, or use the .myshopify.com URL.',
        },
        {
          name: `SHOPIFY_CLI_THEME_TOKEN_${suffix}`,
          required: false,
          description: `Store ${store.alias}: Theme access token for CI (staging/live use this for ${store.alias})`,
          whereToGet:
            'Shopify Partners or Admin → Apps → Develop apps → your app → Theme access for this store.',
        }
      );
    }
    list = list.concat(perStore);
  }

  // When multi-store + build, we still need one SHOPIFY_STORE_URL for Lighthouse on main/staging (default store)
  if (isMulti && enableBuildWorkflows && !list.some((s) => s.name === 'SHOPIFY_STORE_URL')) {
    list.push({
      name: 'SHOPIFY_STORE_URL',
      required: false,
      description: 'Default store URL for Lighthouse on main/staging (e.g. your-store.myshopify.com)',
      whereToGet: 'Your theme’s store URL in Shopify Admin → Settings → Domains.',
    });
  }

  return list;
}

/**
 * Per-store secret definitions for a single store (used when adding a store).
 * Returns [SHOPIFY_STORE_URL_<ALIAS>, SHOPIFY_CLI_THEME_TOKEN_<ALIAS>].
 */
export function getSecretsToPromptForNewStore(store) {
  const suffix = aliasToSecretSuffix(store.alias);
  return [
    {
      name: `SHOPIFY_STORE_URL_${suffix}`,
      required: false,
      description: `Store ${store.alias}: Shopify store URL (staging/live use this for ${store.alias})`,
      whereToGet:
        'Shopify Admin → Settings → Domains for this store, or use the .myshopify.com URL.',
    },
    {
      name: `SHOPIFY_CLI_THEME_TOKEN_${suffix}`,
      required: false,
      description: `Store ${store.alias}: Theme access token for CI (staging/live use this for ${store.alias})`,
      whereToGet:
        'Shopify Partners or Admin → Apps → Develop apps → your app → Theme access for this store.',
    },
  ];
}
