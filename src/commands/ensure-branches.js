import pc from 'picocolors';
import { readConfig } from '../lib/config.js';
import {
  isGitRepo,
  currentBranch,
  ensureStagingBranch,
  createStoreBranches,
} from '../lib/git.js';

/**
 * Create missing staging and per-store branches from current HEAD.
 * Use when the repo only has main (e.g. after clone) so the main → staging-<store> sync can run.
 */
export async function ensureBranchesCommand() {
  console.log(pc.bold('\n  climaybe — Ensure Branches\n'));

  const config = readConfig();
  if (!config?.stores) {
    console.log(pc.red('  No climaybe config found. Run "climaybe init" first.\n'));
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

  if (mode === 'multi') {
    for (const alias of aliases) {
      createStoreBranches(alias);
    }
  }

  console.log(pc.bold(pc.green('\n  Branches ensured.\n')));
  console.log(pc.dim('  Push them so CI can run:'));
  console.log(pc.dim('    git push origin staging'));
  if (mode === 'multi') {
    for (const alias of aliases) {
      console.log(pc.dim(`    git push origin staging-${alias} live-${alias}`));
    }
  }
  console.log(pc.dim('  Or push all at once: git push origin --all\n'));
}
