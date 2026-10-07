import pc from 'picocolors';
import { requireThemeProject } from '../lib/theme-guard.js';
import { runThemeCheckGate } from '../lib/theme-check.js';

/**
 * `climaybe check` — Theme Check vs committed baseline (new errors only).
 * @param {{ writeBaseline?: boolean, quiet?: boolean }} opts
 */
export async function checkCommand(opts = {}) {
  const quiet = opts.quiet === true;
  if (!quiet) console.log(pc.bold('\n  climaybe — Check\n'));

  if (!requireThemeProject()) {
    process.exitCode = 1;
    return;
  }

  const code = runThemeCheckGate({
    cwd: process.cwd(),
    writeBaseline: opts.writeBaseline === true,
    quiet,
  });
  process.exitCode = code;
  if (!quiet) console.log('');
}
