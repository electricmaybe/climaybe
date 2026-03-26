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
import { migrateLegacyConfigCommand } from './commands/migrate-legacy-config.js';
import { buildScriptsCommand } from './commands/build-scripts.js';
import { createEntrypointsCommand } from './commands/create-entrypoints.js';
import { serveAll, serveAssets, serveShopify, lintAll, buildAll } from './lib/dev-runtime.js';

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
    .description('Install/update local theme dev kit files (configs, ignores, optional VS Code tasks)')
    .action(addDevKitCommand);

  cmd
    .command('migrate-legacy-config')
    .description('Migrate legacy package.json config to climaybe.config.json (optional workflow refresh)')
    .option('--overwrite', 'Overwrite existing climaybe.config.json')
    .option('-y, --yes', 'Non-interactive; assume "yes" for prompts')
    .option('--no-update-workflows', 'Do not refresh workflows after migrating')
    .action(migrateLegacyConfigCommand);

  cmd
    .command('serve')
    .description('Run local theme dev (Shopify + assets + Theme Check)')
    .option('--no-theme-check', 'Disable Theme Check watcher')
    .action((opts) => serveAll({ includeThemeCheck: opts.themeCheck !== false }));
  cmd.command('serve:shopify').description('Run Shopify theme dev server').action(() => serveShopify());
  cmd
    .command('serve:assets')
    .description('Run assets watch (Tailwind + scripts + Theme Check)')
    .option('--no-theme-check', 'Disable Theme Check watcher')
    .action((opts) => serveAssets({ includeThemeCheck: opts.themeCheck !== false }));

  cmd.command('lint').description('Run theme linting (liquid, js, css)').action(() => lintAll());

  cmd.command('build').description('Build assets (Tailwind + scripts build)').action(() => buildAll());
  cmd.command('build-scripts').description('Build _scripts → assets/index.js').action(buildScriptsCommand);
  cmd
    .command('create-entrypoints')
    .description('Create _scripts/main.js and _styles/main.css (optional)')
    .action(createEntrypointsCommand);

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
    .description('Set up commitlint, Cursor bundle (rules/skills/agents), and project_type: app in climaybe.config.json')
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
  if (packageDir) process.env.CLIMAYBE_PACKAGE_DIR = packageDir;
  if (version) process.env.CLIMAYBE_PACKAGE_VERSION = version;
  createProgram(version, packageDir).parse(argv);
}
