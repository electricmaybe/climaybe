import { spawnSync } from 'node:child_process';
import pc from 'picocolors';
import { getGitHubRepoSpec, hasGitHubRemote, isGhAvailable } from './github-secrets.js';

/** Exact Check Run / job names emitted by climaybe store-qa workflows. */
export const QA_REQUIRED_CHECKS = ['qa-auto', 'qa-manual'];

/** Stable ruleset name — create/update this one only; never touch other rulesets. */
export const QA_RULESET_NAME = 'climaybe QA gate';

/**
 * @param {string} [mode]
 * @returns {string[]} GitHub ruleset ref_name.include patterns for release targets
 */
export function getQaRulesetRefIncludes(mode = 'single') {
  if (mode === 'multi') {
    return ['refs/heads/live-*'];
  }
  return ['refs/heads/main'];
}

/**
 * Desired repository ruleset body for the climaybe QA gate.
 * @param {'single' | 'multi'} [mode]
 */
export function buildQaRulesetPayload(mode = 'single') {
  return {
    name: QA_RULESET_NAME,
    target: 'branch',
    enforcement: 'active',
    conditions: {
      ref_name: {
        include: getQaRulesetRefIncludes(mode),
        exclude: [],
      },
    },
    rules: [
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: false,
          do_not_enforce_on_create: false,
          required_status_checks: QA_REQUIRED_CHECKS.map((context) => ({ context })),
        },
      },
    ],
  };
}

/**
 * Normalize a ruleset (ours or from GitHub) into a comparable shape.
 * Ignores GitHub bookkeeping fields (id, node_id, source, _links, …).
 * @param {object | null | undefined} ruleset
 */
export function normalizeQaRulesetForCompare(ruleset) {
  if (!ruleset || typeof ruleset !== 'object') return null;

  const include = Array.isArray(ruleset.conditions?.ref_name?.include)
    ? [...ruleset.conditions.ref_name.include].map(String).sort()
    : [];
  const exclude = Array.isArray(ruleset.conditions?.ref_name?.exclude)
    ? [...ruleset.conditions.ref_name.exclude].map(String).sort()
    : [];

  const statusRule = Array.isArray(ruleset.rules)
    ? ruleset.rules.find((r) => r && r.type === 'required_status_checks')
    : null;
  const contexts = Array.isArray(statusRule?.parameters?.required_status_checks)
    ? statusRule.parameters.required_status_checks
        .map((c) => (typeof c === 'string' ? c : c?.context))
        .filter(Boolean)
        .map(String)
        .sort()
    : [];

  const strict = statusRule?.parameters?.strict_required_status_checks_policy === true;
  const doNotEnforce = statusRule?.parameters?.do_not_enforce_on_create === true;

  return {
    name: String(ruleset.name || ''),
    target: String(ruleset.target || 'branch'),
    enforcement: String(ruleset.enforcement || ''),
    include,
    exclude,
    contexts,
    strict,
    doNotEnforce,
  };
}

/**
 * @param {object} desired
 * @param {object | null | undefined} existing
 */
export function qaRulesetMatchesDesired(desired, existing) {
  const a = normalizeQaRulesetForCompare(desired);
  const b = normalizeQaRulesetForCompare(existing);
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function runGh(args, cwd = process.cwd(), input = null) {
  return spawnSync('gh', args, {
    cwd,
    input: input == null ? undefined : input,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function parseGhJson(result) {
  const text = `${result?.stdout || ''}`.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function ghErrorText(result) {
  return `${result?.stderr || ''} ${result?.stdout || ''}`.trim();
}

export function isAdminPermissionError(text) {
  const t = String(text || '');
  return (
    /\b403\b/.test(t) ||
    /Forbidden/i.test(t) ||
    /Must have admin/i.test(t) ||
    /not authorized/i.test(t) ||
    /Resource not accessible by integration/i.test(t) ||
    /Insufficient privileges/i.test(t) ||
    /requires .+ admin/i.test(t)
  );
}

/**
 * Default GitHub Rulesets API client via `gh api` (repo-level).
 * @param {{ cwd?: string, repo?: string }} [opts]
 */
export function createGhRulesetClient({ cwd = process.cwd(), repo } = {}) {
  const resolvedRepo = repo || getGitHubRepoSpec(cwd);
  if (!resolvedRepo) {
    throw new Error('Could not resolve owner/repo from origin');
  }

  const headers = ['-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28'];

  function request(method, path, body = null) {
    const args = ['api', '--method', method, ...headers, path];
    if (body != null) {
      args.push('--input', '-');
    }
    const result = runGh(args, cwd, body == null ? null : JSON.stringify(body));
    if (result.status !== 0) {
      const err = new Error(ghErrorText(result) || `gh api ${method} ${path} failed`);
      err.status = result.status;
      err.body = ghErrorText(result);
      throw err;
    }
    return parseGhJson(result);
  }

  return {
    listRulesets() {
      return request('GET', `repos/${resolvedRepo}/rulesets`) || [];
    },
    getRuleset(id) {
      return request('GET', `repos/${resolvedRepo}/rulesets/${id}`);
    },
    createRuleset(payload) {
      return request('POST', `repos/${resolvedRepo}/rulesets`, payload);
    },
    updateRuleset(id, payload) {
      return request('PUT', `repos/${resolvedRepo}/rulesets/${id}`, payload);
    },
  };
}

function emptyResult(extra = {}) {
  return {
    skipped: null,
    action: null,
    dryRun: false,
    rulesetName: QA_RULESET_NAME,
    refs: [],
    checks: [...QA_REQUIRED_CHECKS],
    rulesetId: null,
    message: null,
    error: null,
    ...extra,
  };
}

/**
 * Create or update the climaybe QA gate ruleset. Idempotent; never touches other rulesets.
 *
 * @param {{
 *   mode?: 'single' | 'multi',
 *   cwd?: string,
 *   dryRun?: boolean,
 *   client?: ReturnType<typeof createGhRulesetClient> | null,
 * }} [opts]
 */
export function syncQaRuleset({
  mode = 'single',
  cwd = process.cwd(),
  dryRun = false,
  client = null,
} = {}) {
  const desired = buildQaRulesetPayload(mode);
  const refs = getQaRulesetRefIncludes(mode);

  // Injected clients (tests) bypass remote/gh discovery.
  let api = client;
  if (!api) {
    if (!hasGitHubRemote(cwd)) {
      return emptyResult({ skipped: 'no_github_remote', dryRun, refs });
    }
    if (!isGhAvailable()) {
      return emptyResult({ skipped: 'gh_unavailable', dryRun, refs });
    }

    const repo = getGitHubRepoSpec(cwd);
    if (!repo) {
      return emptyResult({ skipped: 'repo_parse_failed', dryRun, refs });
    }

    try {
      api = createGhRulesetClient({ cwd, repo });
    } catch (err) {
      return emptyResult({
        skipped: 'repo_parse_failed',
        dryRun,
        refs,
        error: err.message,
      });
    }
  }

  let listed;
  try {
    listed = api.listRulesets();
  } catch (err) {
    if (isAdminPermissionError(err.body || err.message)) {
      return emptyResult({
        skipped: 'admin_required',
        dryRun,
        refs,
        error: err.message,
        message:
          'GitHub token lacks admin permission to manage repository rulesets. Grant admin (or rulesets write) and re-run.',
      });
    }
    return emptyResult({
      skipped: 'api_error',
      dryRun,
      refs,
      error: err.message,
      message: err.message,
    });
  }

  const summaries = Array.isArray(listed) ? listed : [];
  const match = summaries.find((r) => r && r.name === QA_RULESET_NAME) || null;

  let existing = null;
  if (match?.id != null) {
    try {
      existing = api.getRuleset(match.id);
    } catch (err) {
      if (isAdminPermissionError(err.body || err.message)) {
        return emptyResult({
          skipped: 'admin_required',
          dryRun,
          refs,
          rulesetId: match.id,
          error: err.message,
          message:
            'GitHub token lacks admin permission to manage repository rulesets. Grant admin (or rulesets write) and re-run.',
        });
      }
      return emptyResult({
        skipped: 'api_error',
        dryRun,
        refs,
        rulesetId: match.id,
        error: err.message,
        message: err.message,
      });
    }
  }

  if (existing && qaRulesetMatchesDesired(desired, existing)) {
    return emptyResult({
      skipped: null,
      action: 'noop',
      dryRun,
      refs,
      rulesetId: existing.id ?? match?.id ?? null,
      message: `Ruleset "${QA_RULESET_NAME}" already matches desired state.`,
    });
  }

  if (dryRun) {
    return emptyResult({
      skipped: null,
      action: existing ? 'update' : 'create',
      dryRun: true,
      refs,
      rulesetId: existing?.id ?? match?.id ?? null,
      message: existing
        ? `Would update ruleset "${QA_RULESET_NAME}" (id ${existing.id ?? match?.id}).`
        : `Would create ruleset "${QA_RULESET_NAME}".`,
      desired,
    });
  }

  try {
    if (existing?.id != null || match?.id != null) {
      const id = existing?.id ?? match.id;
      const updated = api.updateRuleset(id, desired);
      return emptyResult({
        skipped: null,
        action: 'update',
        dryRun: false,
        refs,
        rulesetId: updated?.id ?? id,
        message: `Updated ruleset "${QA_RULESET_NAME}".`,
      });
    }

    const created = api.createRuleset(desired);
    return emptyResult({
      skipped: null,
      action: 'create',
      dryRun: false,
      refs,
      rulesetId: created?.id ?? null,
      message: `Created ruleset "${QA_RULESET_NAME}".`,
    });
  } catch (err) {
    if (isAdminPermissionError(err.body || err.message)) {
      return emptyResult({
        skipped: 'admin_required',
        dryRun: false,
        refs,
        error: err.message,
        message:
          'GitHub token lacks admin permission to manage repository rulesets. Grant admin (or rulesets write) and re-run.',
      });
    }
    return emptyResult({
      skipped: 'api_error',
      dryRun: false,
      refs,
      error: err.message,
      message: err.message,
    });
  }
}

/**
 * @param {ReturnType<typeof syncQaRuleset>} result
 * @param {'single' | 'multi'} [mode]
 */
export function logQaRulesetResult(result, mode = 'single') {
  const prefix = 'QA ruleset';
  if (result.skipped === 'no_github_remote') {
    console.log(pc.dim(`  ${prefix}: skipped (no GitHub origin remote).`));
    return;
  }
  if (result.skipped === 'gh_unavailable') {
    console.log(pc.dim(`  ${prefix}: skipped (gh CLI unavailable or not authenticated).`));
    return;
  }
  if (result.skipped === 'repo_parse_failed') {
    console.log(pc.dim(`  ${prefix}: skipped (could not resolve owner/repo from origin).`));
    return;
  }
  if (result.skipped === 'admin_required') {
    console.log(pc.yellow(`  ${prefix}: ${result.message || 'admin permission required.'}`));
    return;
  }
  if (result.skipped === 'api_error') {
    console.log(pc.red(`  ${prefix}: API error — ${result.message || result.error || 'unknown'}`));
    return;
  }

  const checks = (result.checks || QA_REQUIRED_CHECKS).join(', ');
  const refs = (result.refs || []).join(', ') || '(none)';
  const dry = result.dryRun ? ' [dry-run]' : '';

  if (result.action === 'noop') {
    console.log(pc.dim(`  ${prefix}: already up to date (${mode}-store; ${refs} → ${checks}).`));
    return;
  }
  if (result.action === 'create') {
    console.log(pc.green(`  ${prefix}: ${result.dryRun ? 'would create' : 'created'}${dry} "${QA_RULESET_NAME}" on ${refs} requiring ${checks}.`));
    return;
  }
  if (result.action === 'update') {
    console.log(pc.green(`  ${prefix}: ${result.dryRun ? 'would update' : 'updated'}${dry} "${QA_RULESET_NAME}" on ${refs} requiring ${checks}.`));
    return;
  }
  console.log(pc.dim(`  ${prefix}: no changes (${mode}-store mode).`));
}
