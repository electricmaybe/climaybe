import prompts from 'prompts';
import pc from 'picocolors';
import {
  promptStoreLoop,
  promptPreviewWorkflows,
  promptBuildWorkflows,
  promptConfigureCISecrets,
  promptUpdateExistingSecrets,
  promptSecretValue,
} from '../lib/prompts.js';
import { readConfig, writeConfig } from '../lib/config.js';
import { ensureGitRepo, ensureInitialCommit, ensureStagingBranch, createStoreBranches } from '../lib/git.js';
import { scaffoldWorkflows } from '../lib/workflows.js';
import { createStoreDirectories } from '../lib/store-sync.js';
import {
  isGhAvailable,
  hasGitHubRemote,
  isGlabAvailable,
  hasGitLabRemote,
  listGitHubSecrets,
  listGitLabVariables,
  getStoreUrlSecretsFromConfig,
  getSecretsToPrompt,
  setSecret,
  setGitLabVariable,
} from '../lib/github-secrets.js';

/**
 * Run the full init flow: prompts, config write, git, branches, workflows.
 * Used by both init (when not already inited or user confirms reinit) and reinit.
 */
async function runInitFlow() {
  // 1. Collect stores from user
  const stores = await promptStoreLoop();
  const mode = stores.length > 1 ? 'multi' : 'single';
  const enablePreviewWorkflows = await promptPreviewWorkflows();
  const enableBuildWorkflows = await promptBuildWorkflows();

  console.log(pc.dim(`\n  Mode: ${mode}-store (${stores.length} store(s))`));

  // 2. Build config
  const config = {
    port: 9295,
    default_store: stores[0].domain,
    preview_workflows: enablePreviewWorkflows,
    build_workflows: enableBuildWorkflows,
    stores: {},
  };

  for (const s of stores) {
    config.stores[s.alias] = s.domain;
  }

  // 3. Write package.json config
  writeConfig(config);
  console.log(pc.green('  Updated package.json config.'));

  // 4. Ensure git repo
  ensureGitRepo();
  ensureInitialCommit();

  // 5. Create branches
  if (mode === 'single') {
    ensureStagingBranch();
  } else {
    // Multi-store: staging branch + per-store branches
    ensureStagingBranch();
    for (const s of stores) {
      createStoreBranches(s.alias);
      createStoreDirectories(s.alias);
    }
  }

  // 6. Scaffold workflows
  scaffoldWorkflows(mode, {
    includePreview: enablePreviewWorkflows,
    includeBuild: enableBuildWorkflows,
  });

  // Done
  console.log(pc.bold(pc.green('\n  Setup complete!\n')));

  if (mode === 'single') {
    console.log(pc.dim('  Branches: main, staging'));
    console.log(pc.dim('  Workflow: staging → main with versioning + nightly hotfix tagging'));
  } else {
    console.log(pc.dim('  Branches: main, staging'));
    for (const s of stores) {
      console.log(pc.dim(`    staging-${s.alias}, live-${s.alias}`));
    }
    console.log(pc.dim('  Workflow: staging → main → staging-<store> → live-<store>'));
  }
  console.log(pc.dim(`  Preview workflows: ${enablePreviewWorkflows ? 'enabled' : 'disabled'}`));
  console.log(pc.dim(`  Build workflows: ${enableBuildWorkflows ? 'enabled' : 'disabled'}`));

  console.log(pc.dim('\n  Next steps:'));
  console.log(pc.dim('    1. Add GEMINI_API_KEY to your CI secrets (or configure below)'));
  console.log(pc.dim('    2. Push to GitHub/GitLab and start using the branching workflow'));
  console.log(pc.dim('    3. Tag your first release: git tag v1.0.0\n'));

  const ciHost = await promptConfigureCISecrets();
  if (ciHost === 'skip') return;

  const secretsToPrompt = getSecretsToPrompt({
    enablePreviewWorkflows,
    enableBuildWorkflows,
    mode,
    stores,
  });
  const total = secretsToPrompt.length;
  const setter =
    ciHost === 'github'
      ? { check: isGhAvailable, checkRemote: hasGitHubRemote, set: setSecret, name: 'GitHub' }
      : { check: isGlabAvailable, checkRemote: hasGitLabRemote, set: setGitLabVariable, name: 'GitLab' };

  if (!setter.check()) {
    const installUrl = ciHost === 'github' ? 'https://cli.github.com/' : 'https://gitlab.com/gitlab-org/cli';
    console.log(pc.yellow(`  ${setter.name} CLI is not installed or not logged in.`));
    console.log(pc.dim(`  Install: ${installUrl} — then run ${ciHost === 'github' ? 'gh' : 'glab'} auth login`));
    console.log(
      pc.dim(
        ciHost === 'github'
          ? '  You can add secrets later in the repo: Settings → Secrets and variables → Actions.\n'
          : '  You can add variables later in the repo: Settings → CI/CD → Variables.\n'
      )
    );
    return;
  }
  if (!setter.checkRemote()) {
    console.log(pc.yellow('  This repo has no ' + setter.name + ' remote (origin).'));
    console.log(pc.dim('  Add a remote and push first, then add secrets/variables in the repo Settings.\n'));
    return;
  }

  const existingNames =
    ciHost === 'github' ? listGitHubSecrets() : listGitLabVariables();
  const namesWeWillPrompt = new Set(secretsToPrompt.map((s) => s.name));
  const alreadySet = existingNames.filter((n) => namesWeWillPrompt.has(n));
  if (alreadySet.length > 0) {
    const doUpdate = await promptUpdateExistingSecrets(alreadySet);
    if (!doUpdate) {
      console.log(pc.dim('\n  Skipping. Existing secrets left unchanged.\n'));
      return;
    }
  }

  let setCount = 0;

  // Set store URL(s) from config (domains already added during init) — no prompt
  const storeUrlSecrets = getStoreUrlSecretsFromConfig({
    enablePreviewWorkflows,
    enableBuildWorkflows,
    mode,
    stores,
  });
  for (const { name, value } of storeUrlSecrets) {
    try {
      await setter.set(name, value);
      console.log(pc.green(`  Set ${name} (from store config).`));
      setCount++;
    } catch (err) {
      console.log(pc.red(`  Failed to set ${name}: ${err.message}`));
    }
  }

  console.log(pc.cyan(`\n  Configure ${total} ${setter.name} secret(s)/variable(s). Leave optional ones blank to skip.\n`));
  for (let i = 0; i < secretsToPrompt.length; i++) {
    const secret = secretsToPrompt[i];
    const value = await promptSecretValue(secret, i, total);
    if (value) {
      try {
        await setter.set(secret.name, value);
        console.log(pc.green(`  Set ${secret.name}.`));
        setCount++;
      } catch (err) {
        console.log(pc.red(`  Failed to set ${secret.name}: ${err.message}`));
      }
    }
  }
  if (setCount > 0) {
    console.log(pc.green(`\n  Done. ${setCount} secret(s) set for this repository.\n`));
  }
}

export async function initCommand() {
  console.log(pc.bold('\n  climaybe — Shopify CI/CD Setup\n'));

  const existing = readConfig();
  const hasConfig = existing != null && typeof existing === 'object';

  if (hasConfig) {
    const { reinit } = await prompts({
      type: 'confirm',
      name: 'reinit',
      message: 'This repo already has a climaybe config. Clear everything and reinitialize from scratch?',
      initial: false,
    });
    if (!reinit) {
      console.log(pc.dim('  Use "climaybe add-store" to add more stores.'));
      console.log(pc.dim('  Use "climaybe update-workflows" to refresh workflows.'));
      console.log(pc.dim('  Use "climaybe reinit" to reinitialize from scratch.\n'));
      return;
    }
  }

  await runInitFlow();
}

export async function reinitCommand() {
  console.log(pc.bold('\n  climaybe — Reinitialize CI/CD Setup\n'));
  await runInitFlow();
}
