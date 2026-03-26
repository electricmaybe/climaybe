import pc from 'picocolors';
import { readConfig } from '../lib/config.js';
import { requireThemeProject } from '../lib/theme-guard.js';
import {
  isGitRepo,
  currentBranch,
  ensureStagingBranch,
  createStoreBranches,
  hasOriginRemote,
  pushBranchesToOrigin,
} from '../lib/git.js';

/**
 * Create missing staging and per-store branches from current HEAD.
 * Use when the repo only has main (e.g. after clone) so the main → staging-<store> sync can run.
 */
export async function ensureBranchesCommand() {
  console.log(pc.bold('\n  climaybe — Ensure Branches\n'));

  if (!requireThemeProject()) return;

  const config = readConfig();
  if (!config?.stores) {
    console.log(pc.red('  No climaybe config found. Run "climaybe theme init" (or "climaybe init") first.\n'));
    return;
  }

  if (!isGitRepo()) {
    console.log(pc.red('  Not a git repository. Run "git init" or clone the repo first.\n'));
    return;
  }

  const branch = currentBranch();
  const aliases = Object.keys(config.stores);
  const mode = aliases.length > 1 ? 'multi' : 'single';

  console.log(pc.dim(`  Current branch: ${branch}`));
  console.log(pc.dim(`  Mode: ${mode}-store (${aliases.length} store(s))\n`));

  ensureStagingBranch();
  const branchesToPush = ['staging'];
  for (const alias of aliases) {
    createStoreBranches(alias);
    branchesToPush.push(`staging-${alias}`, `live-${alias}`);
  }

  console.log(pc.bold(pc.green('\n  Branches ensured.\n')));
  if (hasOriginRemote()) {
    try {
      pushBranchesToOrigin(branchesToPush);
      console.log(pc.green('  Pushed ensured branches to origin.\n'));
    } catch (err) {
      console.log(pc.yellow(`  Could not push branches automatically: ${err.message}`));
      console.log(pc.dim('  Push them manually so CI can run:'));
      console.log(pc.dim('    git push origin --all\n'));
    }
  } else {
    console.log(pc.dim('  No origin remote found.'));
    console.log(pc.dim('  Push them after adding a remote so CI can run:'));
    console.log(pc.dim('    git remote add origin <url>'));
    console.log(pc.dim('    git push origin --all\n'));
  }
}
