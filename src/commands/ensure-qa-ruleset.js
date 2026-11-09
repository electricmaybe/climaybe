import pc from 'picocolors';
import { getMode, getStoreAliases, isStoreQaWorkflowsEnabled, readConfig } from '../lib/config.js';
import { requireThemeProject } from '../lib/theme-guard.js';
import { logQaRulesetResult, syncQaRuleset } from '../lib/qa-ruleset.js';

/**
 * Create or update the repo-level "climaybe QA gate" ruleset (qa-auto + qa-manual).
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function ensureQaRulesetCommand(opts = {}) {
  console.log(pc.bold('\n  climaybe — Ensure QA Ruleset\n'));

  if (!requireThemeProject()) return;

  const config = readConfig();
  if (!config?.stores) {
    console.log(pc.red('  No climaybe config found. Run "climaybe theme init" (or "climaybe init") first.\n'));
    process.exitCode = 1;
    return;
  }

  const mode = getMode();
  const aliases = getStoreAliases();
  const dryRun = opts.dryRun === true;
  const storeQaEnabled = isStoreQaWorkflowsEnabled();

  console.log(pc.dim(`  Mode: ${mode}-store (${aliases.length} store(s))`));
  console.log(pc.dim(`  Store QA workflows: ${storeQaEnabled ? 'enabled' : 'disabled (ruleset still applied when you run this command)'}`));
  if (dryRun) console.log(pc.dim('  Dry-run: no API writes'));
  console.log('');

  const result = syncQaRuleset({ mode, cwd: process.cwd(), dryRun });
  logQaRulesetResult(result, mode);

  if (result.skipped === 'admin_required') {
    console.log(
      pc.dim(
        '\n  Needs a GitHub token/user with admin on the repo (classic PAT: repo admin; fine-grained: Administration: Read and write).\n'
      )
    );
    process.exitCode = 1;
    return;
  }
  if (result.skipped === 'api_error') {
    process.exitCode = 1;
    return;
  }
  if (result.skipped === 'gh_unavailable' || result.skipped === 'no_github_remote' || result.skipped === 'repo_parse_failed') {
    process.exitCode = 1;
    return;
  }

  if (result.dryRun && result.desired) {
    console.log(pc.dim('\n  Desired payload:'));
    console.log(pc.dim(JSON.stringify(result.desired, null, 2).replace(/^/gm, '  ')));
  }

  console.log('');
}
