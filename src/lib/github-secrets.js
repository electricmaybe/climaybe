import { spawn, spawnSync, execSync } from 'node:child_process';
import pc from 'picocolors';

function resolveGhInvocation(cwd = process.cwd()) {
  const direct = spawnSync('gh', ['--version'], { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  if (direct.status === 0) return { command: 'gh', prefix: [] };

  const viaNpx = spawnSync('npx', ['--yes', 'gh', '--version'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (viaNpx.status === 0) return { command: 'npx', prefix: ['--yes', 'gh'] };

  return null;
}

/**
 * Secret/variable definitions for CI (GitHub Actions or GitLab CI).
 * condition: 'always' = required for core workflows; 'preview' | 'build' = only when that feature is enabled.
 */
export const SECRET_DEFINITIONS = [
  {
    name: 'GEMINI_API_KEY',
    required: false,
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
    name: 'SHOPIFY_THEME_ACCESS_TOKEN',
    required: false,
    condition: 'preview',
    description: 'Theme access token so CI can push preview themes (password from Shopify Theme Access app)',
    whereToGet:
      'Install the Theme Access app from Shopify: it gives you a password — that password is your theme access token.',
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
    const gh = resolveGhInvocation();
    if (!gh) return false;
    const result = spawnSync(gh.command, [...gh.prefix, 'auth', 'status'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.status === 0;
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
 * Get GitHub repo as "owner/repo" from origin remote. Returns null if not a GitHub URL or parse fails.
 * Used to pass -R to gh when the repo has multiple remotes.
 */
export function getGitHubRepoSpec(cwd = process.cwd()) {
  try {
    const url = execSync('git remote get-url origin', { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
    // https://github.com/owner/repo[.git] or git@github.com:owner/repo[.git]
    const m = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i);
    return m ? `${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
}

/**
 * List repository secret names (GitHub). Returns [] on error or if none.
 */
export function listGitHubSecrets(cwd = process.cwd()) {
  try {
    const gh = resolveGhInvocation(cwd);
    if (!gh) return [];
    const repo = getGitHubRepoSpec(cwd);
    const args = [...gh.prefix, 'secret', 'list', '--json', 'name'];
    if (repo) args.push('-R', repo);
    const result = spawnSync(gh.command, args, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const out = (result.stdout || '').trim();
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
 * Uses -R owner/repo from origin when available so gh works with multiple remotes.
 */
export function setSecret(name, value, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const gh = resolveGhInvocation(cwd);
    if (!gh) {
      reject(new Error('GitHub CLI is not available (tried gh and npx gh)'));
      return;
    }
    const repo = getGitHubRepoSpec(cwd);
    const args = [...gh.prefix, 'secret', 'set', name];
    if (repo) args.push('-R', repo);
    const child = spawn(gh.command, args, {
      stdio: ['pipe', 'inherit', 'inherit'],
      cwd,
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
 * Get store domain for a theme token secret name (single or SHOPIFY_THEME_ACCESS_TOKEN_<ALIAS>).
 * Returns store domain or null if not found.
 */
export function getStoreUrlForThemeTokenSecret(secretName, stores = []) {
  if (!stores.length) return null;
  if (secretName === 'SHOPIFY_THEME_ACCESS_TOKEN') return stores[0]?.domain ?? null;
  if (!secretName.startsWith('SHOPIFY_THEME_ACCESS_TOKEN_')) return null;
  const suffix = secretName.replace('SHOPIFY_THEME_ACCESS_TOKEN_', '');
  const store = stores.find((s) => aliasToSecretSuffix(s.alias) === suffix);
  return store?.domain ?? null;
}

/**
 * Test theme access token against the store (read-only list). Never logs or persists the token.
 * Returns { ok: true } or { ok: false, error: string }. Safe to call; token only sent to Shopify CLI.
 */
export function validateThemeAccessToken(storeUrl, token) {
  if (!storeUrl || !token) return { ok: false, error: 'Missing store URL or token' };
  return new Promise((resolve) => {
    const child = spawn('shopify', ['theme', 'list', '--store', storeUrl, '--password', token], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (err) => {
      resolve({ ok: false, error: err.code === 'ENOENT' ? 'Shopify CLI not installed (npm install -g @shopify/cli @shopify/theme)' : err.message });
    });
    child.on('close', (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, error: stderr.trim() || `Exit code ${code}` });
    });
  });
}

/**
 * Store URL secrets are set from config (store domains added during init), not prompted.
 * Returns [{ name, value }] for SHOPIFY_STORE_URL and/or SHOPIFY_STORE_URL_<ALIAS>.
 */
export function getStoreUrlSecretsFromConfig({ enablePreviewWorkflows, enableBuildWorkflows, mode = 'single', stores = [] }) {
  if (stores.length === 0) return [];
  const isMulti = mode === 'multi' && stores.length > 1;
  const out = [];

  if (isMulti && enablePreviewWorkflows) {
    for (const store of stores) {
      out.push({ name: `SHOPIFY_STORE_URL_${aliasToSecretSuffix(store.alias)}`, value: store.domain });
    }
  }
  if (!isMulti && (enablePreviewWorkflows || enableBuildWorkflows)) {
    out.push({ name: 'SHOPIFY_STORE_URL', value: stores[0].domain });
  }
  if (isMulti && enableBuildWorkflows) {
    const defaultDomain = stores[0]?.domain;
    if (defaultDomain && !out.some((s) => s.name === 'SHOPIFY_STORE_URL')) {
      out.push({ name: 'SHOPIFY_STORE_URL', value: defaultDomain });
    }
  }
  return out;
}

/**
 * Get secrets we need to prompt for (excludes store URLs; those are set from config).
 * Theme token(s) are required when preview is enabled. In multi-store, all Shopify tokens are per-store.
 */
export function getSecretsToPrompt({ enablePreviewWorkflows, enableBuildWorkflows, mode = 'single', stores = [] }) {
  const isMulti = mode === 'multi' && stores.length > 1;

  const base = SECRET_DEFINITIONS.filter((s) => {
    if (s.name === 'SHOPIFY_STORE_URL') return false; // set from config
    if (s.condition === 'always') return true;
    if (s.condition === 'preview_or_build') return enablePreviewWorkflows || enableBuildWorkflows;
    if (s.condition === 'preview' && enablePreviewWorkflows) return true;
    if (s.condition === 'build' && enableBuildWorkflows) return true;
    return false;
  });

  // Multi-store: drop generic Shopify tokens; we prompt per-store below
  const dropForMulti =
    isMulti
      ? (s) =>
          s.name !== 'SHOPIFY_THEME_ACCESS_TOKEN' &&
          s.name !== 'SHOP_ACCESS_TOKEN' &&
          s.name !== 'SHOP_PASSWORD'
      : () => true;

  let list = base.filter(dropForMulti);

  // Multi-store: prompt per store (theme token, then access token + password if build) so user configures one store at a time
  if (isMulti) {
    for (const store of stores) {
      const suffix = aliasToSecretSuffix(store.alias);
      if (enablePreviewWorkflows) {
        list.push({
          name: `SHOPIFY_THEME_ACCESS_TOKEN_${suffix}`,
          required: false,
          description: `Store ${store.alias}: Theme access token (password from Theme Access app)`,
          whereToGet: 'Theme Access app in Shopify — the password it gives is the token for this store.',
        });
      }
      if (enableBuildWorkflows) {
        list.push(
          {
            name: `SHOP_ACCESS_TOKEN_${suffix}`,
            required: false,
            description: `Store ${store.alias}: API access token for Lighthouse`,
            whereToGet:
              'Shopify Admin → Develop apps → your app → API credentials (Admin/storefront access).',
          },
          {
            name: `SHOP_PASSWORD_${suffix}`,
            required: false,
            description: `Store ${store.alias}: Storefront password if protected (optional)`,
            whereToGet: 'Storefront password in Shopify Admin for this store.',
          }
        );
      }
    }
  }

  return list;
}

/**
 * Store URL for a new store (set from store.domain, no prompt).
 */
export function getStoreUrlSecretForNewStore(store) {
  return { name: `SHOPIFY_STORE_URL_${aliasToSecretSuffix(store.alias)}`, value: store.domain };
}

/**
 * Per-store secrets to prompt for when adding a store (URL is set from store.domain).
 */
export function getSecretsToPromptForNewStore(store) {
  const suffix = aliasToSecretSuffix(store.alias);
  return [
    {
      name: `SHOPIFY_THEME_ACCESS_TOKEN_${suffix}`,
      required: false,
      description: `Store ${store.alias}: Theme access token (password from Theme Access app)`,
      whereToGet: 'Theme Access app in Shopify — the password it gives is the token for this store.',
    },
    {
      name: `SHOP_ACCESS_TOKEN_${suffix}`,
      required: false,
      description: `Store ${store.alias}: API access token for Lighthouse (if using build workflows)`,
      whereToGet: 'Shopify Admin → Develop apps → your app → API credentials.',
    },
    {
      name: `SHOP_PASSWORD_${suffix}`,
      required: false,
      description: `Store ${store.alias}: Storefront password if protected (optional)`,
      whereToGet: 'Storefront password in Shopify Admin for this store.',
    },
  ];
}
