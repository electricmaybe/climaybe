import prompts from 'prompts';
import pc from 'picocolors';
import { readConfig, readPkg, writeConfig } from '../lib/config.js';
import { getDevKitExistingFiles, scaffoldThemeDevKit } from '../lib/theme-dev-kit.js';
import { promptProjectName, promptVSCodeDevTasks } from '../lib/prompts.js';

export async function addDevKitCommand() {
  console.log(pc.bold('\n  climaybe — Add theme dev kit\n'));

  const includeVSCodeTasks = await promptVSCodeDevTasks();
  const existing = getDevKitExistingFiles({ includeVSCodeTasks });
  if (existing.length > 0) {
    console.log(pc.yellow('  Some dev kit files already exist and will be replaced:'));
    for (const path of existing) console.log(pc.yellow(`    - ${path}`));
    const { ok } = await prompts({
      type: 'confirm',
      name: 'ok',
      message: 'Replace these files?',
      initial: true,
    });
    if (!ok) {
      console.log(pc.dim('  Cancelled.\n'));
      return;
    }
  }

  const config = readConfig() || {};
  const projectName = !readPkg() ? await promptProjectName() : undefined;
  scaffoldThemeDevKit({
    includeVSCodeTasks,
    defaultStoreDomain: config.default_store || '',
    packageName: projectName || undefined,
  });
  writeConfig({ dev_kit: true, vscode_tasks: includeVSCodeTasks });

  console.log(pc.green('  Theme dev kit installed.'));
  console.log(pc.dim('  Added local dev-kit config files and ignore defaults.\n'));
}
