import { Command } from 'commander';
import { initCommand, reinitCommand } from './commands/init.js';
import { addStoreCommand } from './commands/add-store.js';
import { switchCommand } from './commands/switch.js';
import { syncCommand } from './commands/sync.js';
import { updateWorkflowsCommand } from './commands/update-workflows.js';
import { ensureBranchesCommand } from './commands/ensure-branches.js';
import { setupCommitlintCommand } from './commands/setup-commitlint.js';
import { addCursorSkillCommand } from './commands/add-cursor-skill.js';
import { addDevKitCommand } from './commands/add-dev-kit.js';
import { appInitCommand } from './commands/app-init.js';

/**
 * Register theme CI/CD commands on a Commander instance (root or `theme` subgroup).
 * @param {import('commander').Command} cmd
 */
function registerThemeCommands(cmd) {
  cmd
    .command('init')
    .description('Initialize CI/CD setup for a Shopify theme repo')
    .action(initCommand);

  cmd
    .command('reinit')
    .description('Reinitialize theme CI/CD (re-scaffold workflows from templates)')
    .action(reinitCommand);

  cmd
    .command('add-store')
    .description('Add a new store to an existing multi-store config')
    .action(addStoreCommand);

  cmd
    .command('switch')
    .argument('<alias>', 'Store alias to switch to')
    .description('Switch local dev environment to a specific store')
    .action(switchCommand);

  cmd
    .command('sync')
    .argument('[alias]', 'Store alias to sync to (defaults to active store)')
    .description('Sync root JSON files back to a store directory')
    .action(syncCommand);

  cmd
    .command('add-dev-kit')
    .description('Install/update local theme dev kit files (scripts, lint, ignores, optional VS Code tasks)')
    .action(addDevKitCommand);

  cmd
    .command('update-workflows')
    .description('Refresh GitHub Actions workflows from latest bundled templates')
    .action(updateWorkflowsCommand);

  cmd
    .command('ensure-branches')
    .description('Create missing staging and per-store branches from current HEAD (then push)')
    .action(ensureBranchesCommand);
}

/**
 * Create the CLI program (for testing and for run).
 * @param {string} [version] - Version string (from bin/cli.js when run as CLI; from package.json in tests).
 * @param {string} [packageDir] - Package root dir (shown with --version so user can see which install is running).
 */
export function createProgram(version = '0.0.0', packageDir = '') {
  const program = new Command();
  const versionDisplay = packageDir ? `${version}\n  from: ${packageDir}` : version;

  program
    .name('climaybe')
    .description(
      'Shopify CLI — theme CI/CD (workflows, branches, stores) and app repo helpers (commitlint, Cursor bundle)'
    )
    .version(versionDisplay);

  const theme = program
    .command('theme')
    .description('Shopify theme CI/CD: workflows, branches, and multi-store config');

  registerThemeCommands(theme);
  registerThemeCommands(program);

  const app = program.command('app').description('Shopify app repo helpers (no theme workflows)');
  app
    .command('init')
    .description('Set up commitlint, Cursor bundle (rules/skills/agents), and project_type: app in package.json')
    .action(appInitCommand);

  program
    .command('setup-commitlint')
    .description('Set up only commitlint + Husky (conventional commits on git commit)')
    .action(setupCommitlintCommand);

  program
    .command('add-cursor')
    .alias('add-cursor-skill')
    .description(
      'Install Electric Maybe Cursor bundle (.cursor/rules, .cursor/skills, .cursor/agents)',
    )
    .action(addCursorSkillCommand);

  return program;
}

export function run(argv, version, packageDir = '') {
  createProgram(version, packageDir).parse(argv);
}
