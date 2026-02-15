import { execSync } from 'node:child_process';
import pc from 'picocolors';

const exec = (cmd, cwd = process.cwd()) =>
  execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();

/**
 * Check if current directory is a git repo.
 */
export function isGitRepo(cwd = process.cwd()) {
  try {
    exec('git rev-parse --is-inside-work-tree', cwd);
    return true;
  } catch {
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
  } catch {
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
  } catch {
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
