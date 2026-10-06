import pc from 'picocolors';
import { requireThemeProject } from '../lib/theme-guard.js';
import { logHarnessResult, scaffoldHarness } from '../lib/harness.js';

/**
 * `climaybe harness` — scaffold coding-agent harness files (never overwrite real files).
 * @param {{ dryRun?: boolean, yes?: boolean }} opts
 */
export async function harnessCommand(opts = {}) {
  console.log(pc.bold('\n  climaybe — Harness\n'));

  if (!requireThemeProject()) return;

  const dryRun = opts.dryRun === true;
  // --yes is accepted for non-interactive CI; scaffolding never overwrites, so no confirm needed.
  void opts.yes;

  const result = scaffoldHarness({
    cwd: process.cwd(),
    dryRun,
    markEnabled: !dryRun,
  });
  logHarnessResult(result, { dryRun });
  console.log('');
}
