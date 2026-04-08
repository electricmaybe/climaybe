import pc from 'picocolors';
import {
  getMode,
  isBuildWorkflowsEnabled,
  isCommitlintEnabled,
  isCursorSkillsEnabled,
  isPreviewWorkflowsEnabled,
  isProfileWorkflowsEnabled,
  readConfig,
} from '../lib/config.js';
import { scaffoldWorkflows } from '../lib/workflows.js';
import { requireThemeProject } from '../lib/theme-guard.js';
import { scaffoldThemeDevKit } from '../lib/theme-dev-kit.js';
import { scaffoldCommitlint } from '../lib/commit-tooling.js';
import { scaffoldCursorBundle } from '../lib/cursor-bundle.js';

export async function updateCommand() {
  console.log(pc.bold('\n  climaybe — Update\n'));

  if (!requireThemeProject()) return;

  const config = readConfig();
  if (!config?.stores) {
    console.log(pc.red('  No climaybe config found. Run "climaybe theme init" (or "climaybe init") first.\n'));
    return;
  }

  const mode = getMode();
  const includePreview = isPreviewWorkflowsEnabled();
  const includeBuild = isBuildWorkflowsEnabled();
  const includeProfile = isProfileWorkflowsEnabled();

  // Keep theme project files in sync (root files, package.json, .gitignore, VS Code tasks).
  scaffoldThemeDevKit({
    includeVSCodeTasks: !!config.vscode_tasks,
    defaultStoreDomain: config.default_store || '',
  });

  if (isCommitlintEnabled()) {
    scaffoldCommitlint(process.cwd(), { skipInstall: true });
  }
  if (isCursorSkillsEnabled()) {
    scaffoldCursorBundle();
  }

  scaffoldWorkflows(mode, { includePreview, includeBuild, includeProfile });

  console.log(pc.bold(pc.green('\n  Project files updated!\n')));
}

// Backward-compatible export for old command name.
export const updateWorkflowsCommand = updateCommand;
