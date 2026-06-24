import { execSync, spawnSync } from 'node:child_process';
import pc from 'picocolors';
import { getGitHubRepoSpec, hasGitHubRemote, isGhAvailable } from './github-secrets.js';

export const LIVE_BRANCH_BYPASS_USERS = ['shopify[bot]', 'github-actions[bot]', 'actions-user'];

function runGh(args, cwd = process.cwd(), input = null) {
  return spawnSync('gh', args, {
    cwd,
    input: input == null ? undefined : input,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function remoteBranchExists(branch, cwd = process.cwd()) {
  try {
    execSync(`git ls-remote --exit-code --heads origin ${branch}`, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function isNotFoundError(result) {
  const text = `${result?.stdout || ''} ${result?.stderr || ''}`;
  return /404|not found|branch not found/i.test(text);
}

export function getBranchProtectionTargets(mode = 'single', aliases = []) {
  const liveBranches = aliases.map((alias) => `live-${alias}`);
  if (mode === 'multi') {
    return {
      protect: liveBranches,
      unprotect: ['main'],
    };
  }
  return {
    protect: ['main'],
    unprotect: liveBranches,
  };
}

export function buildBranchProtectionPayload({ allowShopifyBypass = false } = {}) {
  return {
    required_status_checks: null,
    enforce_admins: true,
    required_pull_request_reviews: {
      dismiss_stale_reviews: false,
      require_code_owner_reviews: false,
      required_approving_review_count: 0,
      require_last_push_approval: false,
      bypass_pull_request_allowances: {
        users: allowShopifyBypass ? LIVE_BRANCH_BYPASS_USERS : [],
        teams: [],
        apps: [],
      },
    },
    restrictions: null,
    required_linear_history: false,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_conversation_resolution: true,
    lock_branch: false,
    allow_fork_syncing: true,
  };
}

function protectBranch({ repo, branch, allowShopifyBypass = false, cwd = process.cwd() }) {
  const path = `repos/${repo}/branches/${branch}/protection`;
  const payload = JSON.stringify(buildBranchProtectionPayload({ allowShopifyBypass }));
  const result = runGh(
    [
      'api',
      '--method',
      'PUT',
      '-H',
      'Accept: application/vnd.github+json',
      path,
      '--input',
      '-',
    ],
    cwd,
    payload
  );
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `gh api failed for ${branch}`).trim());
  }
}

function unprotectBranch({ repo, branch, cwd = process.cwd() }) {
  const path = `repos/${repo}/branches/${branch}/protection`;
  const result = runGh(
    [
      'api',
      '--method',
      'DELETE',
      '-H',
      'Accept: application/vnd.github+json',
      path,
    ],
    cwd
  );
  if (result.status !== 0 && !isNotFoundError(result)) {
    throw new Error((result.stderr || result.stdout || `gh api failed for ${branch}`).trim());
  }
}

export function syncBranchProtection({ mode = 'single', aliases = [], cwd = process.cwd() } = {}) {
  if (!hasGitHubRemote(cwd)) {
    return { skipped: 'no_github_remote', applied: [], removed: [], pending: [], failed: [] };
  }
  if (!isGhAvailable()) {
    return { skipped: 'gh_unavailable', applied: [], removed: [], pending: [], failed: [] };
  }

  const repo = getGitHubRepoSpec(cwd);
  if (!repo) {
    return { skipped: 'repo_parse_failed', applied: [], removed: [], pending: [], failed: [] };
  }

  const { protect, unprotect } = getBranchProtectionTargets(mode, aliases);
  const applied = [];
  const removed = [];
  const pending = [];
  const failed = [];

  for (const branch of unprotect) {
    if (!remoteBranchExists(branch, cwd)) continue;
    try {
      unprotectBranch({ repo, branch, cwd });
      removed.push(branch);
    } catch (err) {
      failed.push({ branch, action: 'unprotect', message: err.message });
    }
  }

  for (const branch of protect) {
    if (!remoteBranchExists(branch, cwd)) {
      pending.push(branch);
      continue;
    }
    try {
      const isLive = /^live-/.test(branch);
      protectBranch({
        repo,
        branch,
        allowShopifyBypass: isLive,
        cwd,
      });
      applied.push(branch);
    } catch (err) {
      failed.push({ branch, action: 'protect', message: err.message });
    }
  }

  return { skipped: null, applied, removed, pending, failed };
}

export function logBranchProtectionResult(result, mode = 'single') {
  if (result.skipped === 'no_github_remote') {
    console.log(pc.dim('  Branch protection: skipped (no GitHub origin remote).'));
    return;
  }
  if (result.skipped === 'gh_unavailable') {
    console.log(pc.dim('  Branch protection: skipped (gh CLI unavailable or not authenticated).'));
    return;
  }
  if (result.skipped === 'repo_parse_failed') {
    console.log(pc.dim('  Branch protection: skipped (could not resolve owner/repo from origin).'));
    return;
  }

  if (result.removed.length > 0) {
    console.log(pc.green(`  Branch protection removed: ${result.removed.join(', ')}`));
  }
  if (result.applied.length > 0) {
    console.log(pc.green(`  Branch protection applied: ${result.applied.join(', ')}`));
  }
  if (result.pending.length > 0) {
    console.log(
      pc.yellow(
        `  Branch protection pending for non-remote branch(es): ${result.pending.join(', ')} (push branches, then run "climaybe ensure-branches")`
      )
    );
  }
  if (result.failed.length > 0) {
    for (const item of result.failed) {
      console.log(pc.red(`  Branch protection ${item.action} failed for ${item.branch}: ${item.message}`));
    }
  }
  if (
    result.applied.length === 0 &&
    result.removed.length === 0 &&
    result.pending.length === 0 &&
    result.failed.length === 0
  ) {
    console.log(pc.dim(`  Branch protection: no changes needed (${mode}-store mode).`));
  }
}
