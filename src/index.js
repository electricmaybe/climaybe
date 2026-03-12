import { Command } from 'commander';
import { initCommand, reinitCommand } from './commands/init.js';
import { addStoreCommand } from './commands/add-store.js';
import { switchCommand } from './commands/switch.js';
import { syncCommand } from './commands/sync.js';
import { updateWorkflowsCommand } from './commands/update-workflows.js';
import { ensureBranchesCommand } from './commands/ensure-branches.js';

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
    .description('Shopify CI/CD CLI — scaffolds workflows, branch strategy, and store config')
    .version(versionDisplay);

  program
    .command('init')
    .description('Initialize CI/CD setup for a Shopify theme repo')
    .action(initCommand);

  program
    .command('reinit')
    .description('Reinitialize CI/CD setup (removes existing config and re-scaffolds workflows)')
    .action(reinitCommand);

  program
    .command('add-store')
    .description('Add a new store to an existing multi-store config')
    .action(addStoreCommand);

  program
    .command('switch')
    .argument('<alias>', 'Store alias to switch to')
    .description('Switch local dev environment to a specific store')
    .action(switchCommand);

  program
    .command('sync')
    .argument('[alias]', 'Store alias to sync to (defaults to active store)')
    .description('Sync root JSON files back to a store directory')
    .action(syncCommand);

  program
    .command('update-workflows')
    .description('Refresh GitHub Actions workflows from latest bundled templates')
    .action(updateWorkflowsCommand);

  program
    .command('ensure-branches')
    .description('Create missing staging and per-store branches from current HEAD (then push)')
    .action(ensureBranchesCommand);

  return program;
}

export function run(argv, version, packageDir = '') {
  createProgram(version, packageDir).parse(argv);
}
