import { buildAutofixPackage, renderAutofixPrompt } from './report.js';

const CURSOR_AGENTS_URL = 'https://api.cursor.com/v0/agents';
// v1 path (preferred); fall back notes in docs if org still on v0
const CURSOR_AGENTS_URL_V1 = 'https://api.cursor.com/v1/agents';

/**
 * Secret name theme repos should set for optional auto-fix.
 * When unset, the auto-fix step no-ops.
 */
export const CURSOR_API_KEY_SECRET = 'CURSOR_API_KEY';

/**
 * Marker label / comment prefix for one autofix attempt per head SHA.
 * @param {string} headSha
 */
export function autofixMarkerForSha(headSha) {
  const short = String(headSha || '').slice(0, 7);
  return `climaybe-qa-autofix:${short}`;
}

/**
 * @param {string} body
 * @param {string} headSha
 */
export function commentHasAutofixMarker(body, headSha) {
  const marker = `<!-- ${autofixMarkerForSha(headSha)} -->`;
  return String(body || '').includes(marker);
}

/**
 * Launch a Cursor cloud agent against the same PR branch.
 * No-ops when apiKey is missing.
 *
 * @param {{
 *   apiKey?: string,
 *   repositoryUrl: string,
 *   prUrl: string,
 *   headSha: string,
 *   branch?: string,
 *   previewUrl?: string,
 *   results: import('./report.js').QaResultRow[],
 *   artifactUrls?: string[],
 *   fetchImpl?: typeof fetch,
 * }} opts
 */
export async function triggerCursorAutofix(opts) {
  const apiKey = opts.apiKey || process.env.CURSOR_API_KEY || '';
  if (!apiKey) {
    return { ok: false, skipped: true, reason: 'missing-secret', secret: CURSOR_API_KEY_SECRET };
  }

  const failures = (opts.results || []).filter((r) => r.status === 'failed');
  if (!failures.length) {
    return { ok: true, skipped: true, reason: 'no-failures' };
  }

  const pkg = buildAutofixPackage({
    headSha: opts.headSha,
    previewUrl: opts.previewUrl,
    prUrl: opts.prUrl,
    branch: opts.branch,
    results: opts.results,
    artifactUrls: opts.artifactUrls,
  });
  const promptText = renderAutofixPrompt(pkg);
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return { ok: false, skipped: false, reason: 'no-fetch' };
  }

  const body = {
    prompt: { text: promptText },
    repos: [
      {
        url: opts.repositoryUrl,
        prUrl: opts.prUrl,
      },
    ],
    workOnCurrentBranch: true,
    name: `store-qa-autofix-${String(opts.headSha || '').slice(0, 7)}`,
  };

  const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;

  for (const url of [CURSOR_AGENTS_URL_V1, CURSOR_AGENTS_URL]) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
      if (res.ok) {
        return {
          ok: true,
          skipped: false,
          marker: autofixMarkerForSha(opts.headSha),
          agent: json,
          endpoint: url,
        };
      }
      // Try next endpoint on 404
      if (res.status === 404) continue;
      return {
        ok: false,
        skipped: false,
        reason: 'api-error',
        status: res.status,
        body: json,
        endpoint: url,
      };
    } catch (err) {
      return {
        ok: false,
        skipped: false,
        reason: 'network-error',
        error: err instanceof Error ? err.message : String(err),
        endpoint: url,
      };
    }
  }

  return { ok: false, skipped: false, reason: 'api-unreachable' };
}
