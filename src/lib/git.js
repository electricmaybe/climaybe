import { execSync } from 'node:child_process';
import pc from 'picocolors';

const exec = (cmd, cwd = process.cwd()) =>
  execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();

function isExpectedGitError(err, patterns) {
  const text = [err.message, err.stderr].filter(Boolean).join(' ');
  return patterns.some((p) => text.includes(p));
}

/**
 * Check if current directory is a git repo.
 */
export function isGitRepo(cwd = process.cwd()) {
  try {
    exec('git rev-parse --is-inside-work-tree', cwd);
    return true;
  } catch (err) {
    if (!isExpectedGitError(err, ['not a git repository'])) {
      console.error(err);
    }
    return false;
  }
}

/**
 * Get the current branch name.
 */
export function currentBranch(cwd = process.cwd()) {
  return exec('git rev-parse --abbrev-ref HEAD', cwd);
}

/**
 * Check if a local branch exists.
 */
export function branchExists(name, cwd = process.cwd()) {
  try {
    exec(`git rev-parse --verify ${name}`, cwd);
    return true;
  } catch (err) {
    if (!isExpectedGitError(err, ['Needed a single revision'])) {
      console.error(err);
    }
    return false;
  }
}

/**
 * Create a new branch from current HEAD (does not checkout).
 */
export function createBranch(name, cwd = process.cwd()) {
  if (branchExists(name, cwd)) {
    console.log(pc.yellow(`  Branch "${name}" already exists, skipping.`));
    return false;
  }
  exec(`git branch ${name}`, cwd);
  console.log(pc.green(`  Created branch: ${name}`));
  return true;
}

/**
 * Create staging and live branches for a store alias.
 */
export function createStoreBranches(alias, cwd = process.cwd()) {
  const staging = `staging-${alias}`;
  const live = `live-${alias}`;
  createBranch(staging, cwd);
  createBranch(live, cwd);
}

/**
 * Ensure the staging branch exists (for single-store mode).
 */
export function ensureStagingBranch(cwd = process.cwd()) {
  createBranch('staging', cwd);
}

/**
 * Create an initial commit if the repo has no commits.
 */
export function ensureInitialCommit(cwd = process.cwd()) {
  try {
    exec('git rev-parse HEAD', cwd);
  } catch (err) {
    const expectedNoCommit = isExpectedGitError(err, [
      'unknown revision',
      'path not in the working tree',
    ]);
    if (!expectedNoCommit) {
      console.error(err);
    }
    // No commits yet — create an initial one
    exec('git add -A', cwd);
    exec('git commit -m "chore: initial commit" --allow-empty', cwd);
    console.log(pc.green('  Created initial commit.'));
  }
}

/**
 * Initialize a git repo if not already one.
 */
export function ensureGitRepo(cwd = process.cwd()) {
  if (!isGitRepo(cwd)) {
    exec('git init', cwd);
    console.log(pc.green('  Initialized git repository.'));
  }
}

/**
 * Check if origin remote exists.
 */
export function hasOriginRemote(cwd = process.cwd()) {
  try {
    exec('git remote get-url origin', cwd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Push branches to origin if remote exists.
 */
export function pushBranchesToOrigin(branches = [], cwd = process.cwd()) {
  if (!branches.length) return true;
  const unique = [...new Set(branches)];
  exec(`git push origin ${unique.join(' ')}`, cwd);
  return true;
}

/**
 * Get the latest tag version (e.g. "1.2.3") from v* tags, or null if none.
 * Sorts by version so v2.0.0 > v1.9.9.
 */
export function getLatestTagVersion(cwd = process.cwd()) {
  try {
    const out = exec('git tag -l "v*" --sort=-v:refname', cwd);
    const first = out.split(/\n/)[0]?.trim();
    if (!first || !first.startsWith('v')) return null;
    const match = first.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-|$)/);
    return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
  } catch {
    return null;
  }
}

/**
 * Suggested tag for next release: v1.0.0 if no tags, else next patch (e.g. v1.2.3 → v1.2.4).
 */
export function getSuggestedTagForRelease(cwd = process.cwd()) {
  const latest = getLatestTagVersion(cwd);
  if (!latest) return 'v1.0.0';
  const parts = latest.split('.').map(Number);
  if (parts.length < 3) return 'v1.0.0';
  parts[2] += 1;
  return `v${parts[0]}.${parts[1]}.${parts[2]}`;
}
