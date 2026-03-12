import { Command } from 'commander';
import { initCommand, reinitCommand } from './commands/init.js';
import { addStoreCommand } from './commands/add-store.js';
import { switchCommand } from './commands/switch.js';
import { syncCommand } from './commands/sync.js';
import { updateWorkflowsCommand } from './commands/update-workflows.js';

/**
 * Create the CLI program (for testing and for run).
 */
export function createProgram() {
  const program = new Command();

  program
    .name('climaybe')
    .description('Shopify CI/CD CLI — scaffolds workflows, branch strategy, and store config')
    .version('1.0.0');

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

  return program;
}

export function run(argv) {
  createProgram().parse(argv);
}
