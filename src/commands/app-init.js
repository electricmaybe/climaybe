import prompts from 'prompts';
import pc from 'picocolors';
import { promptCommitlint, promptCursorSkills } from '../lib/prompts.js';
import {
  readConfig,
  writeConfig,
  getProjectType,
  isThemeProjectForAppInit,
} from '../lib/config.js';
import { ensureGitRepo, ensureInitialCommit } from '../lib/git.js';
import { scaffoldCommitlint } from '../lib/commit-tooling.js';
import { scaffoldCursorBundle } from '../lib/cursor-bundle.js';

/**
 * Minimal Shopify app repo setup: commitlint, Cursor bundle, project_type in config.
 * No theme stores, branches, or GitHub Actions theme workflows.
 */
async function runAppInitFlow() {
  const enableCommitlint = await promptCommitlint();
  const enableCursorSkills = await promptCursorSkills();

  const config = {
    project_type: 'app',
    commitlint: enableCommitlint,
    cursor_skills: enableCursorSkills,
  };

  writeConfig(config, process.cwd(), { defaultPackageName: 'shopify-app' });
  console.log(pc.green('  Updated package.json config.'));

  ensureGitRepo();
  ensureInitialCommit();

  if (enableCommitlint) {
    console.log(pc.dim('  Setting up commitlint + Husky...'));
    if (scaffoldCommitlint()) {
      console.log(pc.green('  commitlint + Husky installed (conventional commits enforced on git commit).'));
    } else {
      console.log(pc.yellow('  commitlint setup failed or skipped (run npm install manually).'));
    }
  }
  if (enableCursorSkills) {
    const cursorOk = scaffoldCursorBundle();
    if (cursorOk) {
      console.log(
        pc.green('  Electric Maybe Cursor bundle → .cursor/rules, .cursor/skills, .cursor/agents'),
      );
    } else {
      console.log(pc.yellow('  Cursor bundle not found in package (skipped).'));
    }
  }

  console.log(pc.bold(pc.green('\n  App setup complete!\n')));
  console.log(pc.dim('  commitlint + Husky: ' + (enableCommitlint ? 'enabled' : 'disabled')));
  console.log(pc.dim('  Cursor bundle: ' + (enableCursorSkills ? 'installed' : 'skipped')));
  console.log(pc.dim('\n  Next steps:'));
  console.log(pc.dim('    Use Shopify CLI (`shopify app dev`, etc.) for app development.'));
  console.log(pc.dim('    Theme CI/CD workflows are not installed; add your own deployment as needed.\n'));
}

export async function appInitCommand() {
  console.log(pc.bold('\n  climaybe — Shopify app setup\n'));

  if (isThemeProjectForAppInit()) {
    console.log(
      pc.red(
        '  This repo looks like a theme project (stores in config or project_type: theme).'
      )
    );
    console.log(pc.dim('  Use: npx climaybe theme init   (or: npx climaybe init)\n'));
    return;
  }

  const existing = readConfig();
  const hasConfig = existing != null && typeof existing === 'object';

  if (hasConfig && getProjectType() === 'app') {
    const { reinit } = await prompts({
      type: 'confirm',
      name: 'reinit',
      message: 'This repo already has climaybe app config. Re-run setup (merge config and reinstall optional tooling)?',
      initial: false,
    });
    if (!reinit) {
      console.log(pc.dim('  Use "climaybe setup-commitlint" or "climaybe add-cursor" to refresh tooling.\n'));
      return;
    }
  }

  await runAppInitFlow();
}
