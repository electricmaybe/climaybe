import prompts from 'prompts';
import pc from 'picocolors';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { migrateLegacyPackageConfigToClimaybe, readClimaybeConfig, readPkg, writePkg } from '../lib/config.js';
import { updateWorkflowsCommand } from './update-workflows.js';
import { requireThemeProject } from '../lib/theme-guard.js';
import { getDevKitExistingFiles, scaffoldThemeDevKit } from '../lib/theme-dev-kit.js';

const LEGACY_SCRIPT_KEYS = [
  'shopify:serve',
  'shopify:serve:sync',
  'shopify:populate',
  'scripts:build',
  'scripts:watch',
  'tailwind:watch',
  'tailwind:build',
  'dev',
  'dev:theme',
  'dev:assets',
  'dev:no-sync',
  'lint:liquid',
  'lint:js',
  'lint:css',
  'release',
  'prepare',
];

const LEGACY_DEP_NAMES = [
  'concurrently',
  'nodemon',
  'tailwindcss',
  '@tailwindcss/cli',
  '@tailwindcss/typography',
  'eslint',
  '@eslint/js',
  '@eslint/create-config',
  'stylelint',
  'stylelint-config-standard',
  'prettier',
  '@shopify/prettier-plugin-liquid',
  '@commitlint/cli',
  '@commitlint/config-conventional',
  'husky',
];

function cleanupLegacyFiles(cwd) {
  const candidates = [
    '.climaybe/build-scripts.js',
    'build-scripts.js',
    '.climaybe/dev-with-sync.sh',
    '.climaybe/dev.sh',
  ];
  const removed = [];
  for (const rel of candidates) {
    const abs = join(cwd, rel);
    if (!existsSync(abs)) continue;
    rmSync(abs, { force: true });
    removed.push(rel);
  }
  return removed;
}

function cleanupLegacyPackageJson(cwd) {
  const pkg = readPkg(cwd);
  if (!pkg || typeof pkg !== 'object') return { removedScripts: [], removedDeps: [] };

  const removedScripts = [];
  if (pkg.scripts && typeof pkg.scripts === 'object') {
    for (const key of LEGACY_SCRIPT_KEYS) {
      if (key in pkg.scripts) {
        delete pkg.scripts[key];
        removedScripts.push(key);
      }
    }
    if (Object.keys(pkg.scripts).length === 0) delete pkg.scripts;
  }

  const removedDeps = [];
  for (const depField of ['dependencies', 'devDependencies']) {
    const deps = pkg[depField];
    if (!deps || typeof deps !== 'object') continue;
    for (const name of LEGACY_DEP_NAMES) {
      if (name in deps) {
        delete deps[name];
        removedDeps.push(`${depField}:${name}`);
      }
    }
    if (Object.keys(deps).length === 0) delete pkg[depField];
  }

  writePkg(pkg, cwd);
  return { removedScripts, removedDeps };
}

export async function migrateLegacyConfigCommand(options = {}) {
  const overwrite = options.overwrite === true;
  const updateWorkflows = options.updateWorkflows !== false;
  const yes = options.yes === true;

  console.log(pc.bold('\n  climaybe — Migrate legacy config\n'));

  if (!requireThemeProject()) return;

  const legacy = readPkg()?.config ?? null;
  if (!legacy || typeof legacy !== 'object') {
    console.log(pc.yellow('  No legacy package.json config found (package.json → config).'));
    console.log(pc.dim('  Nothing to migrate.\n'));
    return;
  }

  const existing = readClimaybeConfig();
  if (existing && !overwrite) {
    const ok = yes
      ? true
      : (
          await prompts({
            type: 'confirm',
            name: 'ok',
            message: 'A climaybe.config.json already exists. Overwrite it from package.json config?',
            initial: false,
          })
        ).ok;
    if (!ok) {
      console.log(pc.dim('  Cancelled.\n'));
      return;
    }
  }

  const did = migrateLegacyPackageConfigToClimaybe({ overwrite: true });
  if (!did) {
    console.log(pc.yellow('  Migration skipped (no legacy config, or config already present).'));
    console.log(pc.dim('  Tip: run with --overwrite to force rewrite.\n'));
    return;
  }

  console.log(pc.green('  Migrated package.json config → climaybe.config.json'));

  // Clean legacy dev system artifacts (sample-style package scripts, shims, old .climaybe scripts).
  const cleanup = yes
    ? true
    : (
        await prompts({
          type: 'confirm',
          name: 'cleanup',
          message: 'Remove legacy dev scripts/deps from package.json and delete old local shims?',
          initial: true,
        })
      ).cleanup;
  if (cleanup) {
    const removedFiles = cleanupLegacyFiles(process.cwd());
    const { removedScripts, removedDeps } = cleanupLegacyPackageJson(process.cwd());
    if (removedFiles.length > 0) {
      console.log(pc.green(`  Removed legacy files: ${removedFiles.join(', ')}`));
    }
    if (removedScripts.length > 0) {
      console.log(pc.green(`  Removed legacy package.json scripts: ${removedScripts.join(', ')}`));
    }
    if (removedDeps.length > 0) {
      console.log(pc.green(`  Removed legacy package.json deps: ${removedDeps.join(', ')}`));
    }
  }

  // Reinstall dev kit so tasks/theme-check config match the new climaybe runtime.
  const reinstallDevKit = yes
    ? true
    : (
        await prompts({
          type: 'confirm',
          name: 'reinstallDevKit',
          message: 'Install/refresh climaybe dev kit files (.vscode/tasks.json, etc.)?',
          initial: true,
        })
      ).reinstallDevKit;
  if (reinstallDevKit) {
    const existing = getDevKitExistingFiles({ includeVSCodeTasks: true });
    if (existing.length > 0) {
      console.log(pc.yellow('  Some dev kit files already exist and will be replaced:'));
      for (const path of existing) console.log(pc.yellow(`    - ${path}`));
      const ok = yes
        ? true
        : (
            await prompts({
              type: 'confirm',
              name: 'ok',
              message: 'Replace these files?',
              initial: true,
            })
          ).ok;
      if (!ok) {
        console.log(pc.dim('  Skipped dev kit refresh.\n'));
      } else {
        const legacy = readPkg()?.config ?? {};
        scaffoldThemeDevKit({
          includeVSCodeTasks: true,
          defaultStoreDomain: legacy.default_store || legacy.store || '',
        });
        console.log(pc.green('  Dev kit refreshed.'));
      }
    } else {
      const legacy = readPkg()?.config ?? {};
      scaffoldThemeDevKit({
        includeVSCodeTasks: true,
        defaultStoreDomain: legacy.default_store || legacy.store || '',
      });
      console.log(pc.green('  Dev kit installed.'));
    }
  }

  if (updateWorkflows) {
    console.log(pc.dim('\n  Updating workflows to use climaybe.config.json...\n'));
    await updateWorkflowsCommand();
  } else {
    console.log(pc.dim('  Skipped workflow update (pass --update-workflows to refresh).\n'));
  }
}

