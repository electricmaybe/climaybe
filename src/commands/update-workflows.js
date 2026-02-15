import pc from 'picocolors';
import { getMode, readConfig } from '../lib/config.js';
import { scaffoldWorkflows } from '../lib/workflows.js';

export async function updateWorkflowsCommand() {
  console.log(pc.bold('\n  climaybe — Update Workflows\n'));

  const config = readConfig();
  if (!config?.stores) {
    console.log(pc.red('  No climaybe config found. Run "climaybe init" first.\n'));
    return;
  }

  const mode = getMode();
  scaffoldWorkflows(mode);

  console.log(pc.bold(pc.green('\n  Workflows updated!\n')));
}
