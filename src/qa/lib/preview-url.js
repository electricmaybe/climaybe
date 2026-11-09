/**
 * Extract a preview URL from the climaybe preview PR comment, pinned to head SHA.
 * Also helpers to join a preview base (often `https://host/?preview_theme_id=…`)
 * with a storefront path without swallowing the path into the query string.
 */

/**
 * Join a Playwright/preview base URL with a relative storefront path.
 * Correctly preserves `preview_theme_id` (and any other) query params on the base,
 * and merges query/hash from the path when present.
 *
 * @param {string} baseUrl e.g. `https://shop.myshopify.com/?preview_theme_id=123`
 * @param {string} pathOrUrl e.g. `/products/foo` or `/products/foo?variant=1`
 * @returns {string}
 */
export function joinPreviewUrl(baseUrl, pathOrUrl) {
  const rawPath = String(pathOrUrl || '').trim();
  if (!rawPath) return String(baseUrl || '');
  if (/^https?:\/\//i.test(rawPath)) return rawPath;

  const base = String(baseUrl || '').trim();
  if (!base) {
    return rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  }

  let url;
  try {
    url = new URL(base);
  } catch {
    // Relative or invalid base — fall back to path-only join without query mangling
    const origin = base.replace(/\/$/, '');
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    return `${origin}${path}`;
  }

  const pathUrl = new URL(rawPath.startsWith('/') ? rawPath : `/${rawPath}`, 'https://climaybe.invalid');
  url.pathname = joinPathnames(url.pathname, pathUrl.pathname);
  for (const [key, value] of pathUrl.searchParams.entries()) {
    url.searchParams.set(key, value);
  }
  if (pathUrl.hash) url.hash = pathUrl.hash;
  return url.toString();
}

/**
 * @param {string} basePath
 * @param {string} extraPath
 */
function joinPathnames(basePath, extraPath) {
  const left = String(basePath || '/').replace(/\/+$/, '') || '';
  const right = String(extraPath || '/');
  if (!left || left === '') return right.startsWith('/') ? right : `/${right}`;
  if (right === '/') return left || '/';
  return `${left}${right.startsWith('/') ? right : `/${right}`}`;
}

/**
 * @param {string} body
 * @param {string} headSha
 */
export function previewCommentMatchesHead(body, headSha) {
  const text = String(body || '');
  const sha = String(headSha || '');
  if (!sha || sha.length < 7) return false;
  if (text.includes(`<!-- climaybe-preview-sha:${sha} -->`)) return true;
  if (text.includes(`**Commit:** ${sha}`)) return true;
  // Prefer full SHA; reject short-only matches when full SHA was provided
  if (sha.length >= 40) {
    return text.includes(sha);
  }
  return text.includes(sha);
}

/**
 * Pick the preview storefront URL from a climaybe preview comment.
 * Fails closed (returns null) when SHA does not match or no URL found.
 *
 * @param {string} body
 * @param {{ headSha: string, storeAlias?: string | null }} opts
 * @returns {string | null}
 */
export function pickPreviewUrlFromComment(body, opts) {
  const text = String(body || '');
  const sha = String(opts.headSha || '');
  if (!previewCommentMatchesHead(text, sha)) return null;

  const alias = opts.storeAlias ? String(opts.storeAlias).trim() : '';
  if (alias) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const labeled = new RegExp(
      `\\[${escaped}\\s+preview\\]\\((https?:\\/\\/[^)\\s]+)\\)`,
      'i'
    );
    const m = text.match(labeled);
    if (m?.[1]) return m[1];
  }

  const urls = text.match(/https?:\/\/[^\s)]+/g) || [];
  const preview = urls.find((u) => /preview_theme_id=/i.test(u));
  return preview || null;
}

/**
 * Resolve which store alias Store QA should target.
 * @param {object | null} qaConfig
 * @param {{ baseBranch?: string, headBranch?: string }} [ctx]
 */
export function resolveQaStoreAlias(qaConfig, ctx = {}) {
  if (qaConfig?.default_store_alias) return String(qaConfig.default_store_alias);
  const stores = Array.isArray(qaConfig?.stores) ? qaConfig.stores : [];
  const head = String(ctx.headBranch || '');
  const base = String(ctx.baseBranch || '');
  for (const branch of [head, base]) {
    const m = branch.match(/^(?:staging|live)-(.+)$/);
    if (m) {
      const alias = m[1];
      if (stores.some((s) => s?.alias === alias) || stores.length === 0) return alias;
    }
  }
  return stores[0]?.alias || null;
}
