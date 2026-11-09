/**
 * Extract a preview URL from the climaybe preview PR comment, pinned to head SHA.
 */

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
