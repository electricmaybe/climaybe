import pc from 'picocolors';
import { requireThemeProject } from '../lib/theme-guard.js';
import { runThemeCheckGate } from '../lib/theme-check.js';

/**
 * `climaybe check` — Theme Check vs committed baseline (new errors only).
 * @param {{ writeBaseline?: boolean }} opts
 */
export async function checkCommand(opts = {}) {
  console.log(pc.bold('\n  climaybe — Check\n'));

  if (!requireThemeProject()) {
    process.exitCode = 1;
    return;
  }

  const code = runThemeCheckGate({
    cwd: process.cwd(),
    writeBaseline: opts.writeBaseline === true,
  });
  process.exitCode = code;
  console.log('');
}
