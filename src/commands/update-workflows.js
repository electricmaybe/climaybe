import pc from 'picocolors';
import { getMode, isBuildWorkflowsEnabled, isPreviewWorkflowsEnabled, readConfig } from '../lib/config.js';
import { scaffoldWorkflows } from '../lib/workflows.js';

export async function updateWorkflowsCommand() {
  console.log(pc.bold('\n  climaybe — Update Workflows\n'));

  const config = readConfig();
  if (!config?.stores) {
    console.log(pc.red('  No climaybe config found. Run "climaybe init" first.\n'));
    return;
  }

  const mode = getMode();
  const includePreview = isPreviewWorkflowsEnabled();
  const includeBuild = isBuildWorkflowsEnabled();
  scaffoldWorkflows(mode, { includePreview, includeBuild });

  console.log(pc.bold(pc.green('\n  Workflows updated!\n')));
}
