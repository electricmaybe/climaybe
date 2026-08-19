import prompts from 'prompts';
import pc from 'picocolors';
import {
  getMode,
  isBuildWorkflowsEnabled,
  isPreviewWorkflowsEnabled,
  isProfileWorkflowsEnabled,
  readConfig,
  writeConfig,
} from '../lib/config.js';
import { DEFAULT_LINEAR_STATUSES, normalizeLinearTeamKey, resolveLinearStatuses } from '../lib/linear-status.js';
import { requireThemeProject } from '../lib/theme-guard.js';
import { scaffoldWorkflows } from '../lib/workflows.js';
import { promptLinearApiKey, promptLinearTeam } from '../lib/prompts.js';
import {
  hasGitHubRemote,
  hasGitLabRemote,
  isGhAvailable,
  isGlabAvailable,
  setGitLabVariable,
  setSecret,
} from '../lib/github-secrets.js';

/**
 * One-shot: set LINEAR_API_KEY, enable linear_workflows, refresh the workflow file.
 * Never prints the key.
 * @param {{ team?: string }} [opts]
 */
export async function updateLinearKeyCommand(opts = {}) {
  console.log(pc.bold('\n  climaybe — Update Linear API key\n'));

  if (!requireThemeProject()) return;

  const existing = readConfig() || {};
  const currentTeam = typeof existing.linear_team === 'string' ? existing.linear_team : '';

  let linearTeam = currentTeam;
  const teamFromFlag = normalizeLinearTeamKey(opts.team);
  if (opts.team != null && opts.team !== '') {
    if (teamFromFlag === null) {
      console.log(pc.red('  Invalid --team value. Use 2–10 letters (e.g. VOL).\n'));
      return;
    }
    linearTeam = teamFromFlag;
  } else {
    const { updateTeam } = await prompts({
      type: 'confirm',
      name: 'updateTeam',
      message: currentTeam
        ? `Update Linear team key in config? (currently ${currentTeam})`
        : 'Set Linear team key in config? (e.g. VOL)',
      initial: !currentTeam,
    });
    if (updateTeam) {
      linearTeam = await promptLinearTeam({ initial: currentTeam || 'VOL' });
    }
  }

  console.log(pc.dim('  Linear → Settings → Account → Security & access → Personal API keys'));
  console.log(pc.cyan('  https://linear.app/settings/account/security\n'));

  const apiKey = await promptLinearApiKey();

  const statuses = resolveLinearStatuses(existing);
  const next = {
    linear_workflows: true,
    linear_statuses: {
      staging: statuses.staging || DEFAULT_LINEAR_STATUSES.staging,
      store: statuses.store || DEFAULT_LINEAR_STATUSES.store,
      live: statuses.live || DEFAULT_LINEAR_STATUSES.live,
    },
  };
  if (linearTeam) next.linear_team = linearTeam;
  writeConfig(next);
  console.log(pc.green('  Enabled linear_workflows in climaybe.config.json.'));
  if (linearTeam) console.log(pc.dim(`  Linear team: ${linearTeam}`));

  const mode = getMode();
  scaffoldWorkflows(mode, {
    includePreview: isPreviewWorkflowsEnabled(),
    includeBuild: isBuildWorkflowsEnabled(),
    includeProfile: isProfileWorkflowsEnabled(),
    includeLinear: true,
  });

  if (!apiKey) {
    console.log(pc.dim('  Skipped LINEAR_API_KEY (no value entered). Add it in repo Settings, or re-run this command.'));
    console.log(pc.dim('  Workflow file is in .github/workflows/linear-status-sync.yml.\n'));
    return;
  }

  const githubReady = hasGitHubRemote() && isGhAvailable();
  const gitlabReady = hasGitLabRemote() && isGlabAvailable();

  try {
    if (githubReady) {
      await setSecret('LINEAR_API_KEY', apiKey);
      console.log(pc.green('  Set GitHub secret LINEAR_API_KEY.'));
    } else if (gitlabReady) {
      await setGitLabVariable('LINEAR_API_KEY', apiKey);
      console.log(pc.green('  Set GitLab CI/CD variable LINEAR_API_KEY.'));
    } else if (hasGitHubRemote()) {
      console.log(pc.yellow('  GitHub remote found, but gh CLI is not available or not logged in.'));
      console.log(pc.dim('  Add LINEAR_API_KEY in the repo: Settings → Secrets and variables → Actions.'));
    } else if (hasGitLabRemote()) {
      console.log(pc.yellow('  GitLab remote found, but glab CLI is not available or not logged in.'));
      console.log(pc.dim('  Add LINEAR_API_KEY in the repo: Settings → CI/CD → Variables.'));
    } else {
      console.log(pc.yellow('  No GitHub/GitLab origin remote detected; secret was not uploaded.'));
      console.log(pc.dim('  Add LINEAR_API_KEY in your CI host settings after you push.'));
    }
  } catch {
    console.log(pc.red('  Failed to set LINEAR_API_KEY via CLI. Add it in repo Settings instead.'));
  }

  console.log(pc.dim('\n  Linear issue status sync is ready. Do not commit the API key.\n'));
}
