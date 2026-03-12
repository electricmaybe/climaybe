import prompts from 'prompts';
import pc from 'picocolors';
import { promptStoreLoop, promptPreviewWorkflows, promptBuildWorkflows } from '../lib/prompts.js';
import { readConfig, writeConfig } from '../lib/config.js';
import { ensureGitRepo, ensureInitialCommit, ensureStagingBranch, createStoreBranches } from '../lib/git.js';
import { scaffoldWorkflows } from '../lib/workflows.js';
import { createStoreDirectories } from '../lib/store-sync.js';

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
  console.log(pc.dim('    1. Add GEMINI_API_KEY to your GitHub repo secrets'));
  console.log(pc.dim('    2. Push to GitHub and start using the branching workflow'));
  console.log(pc.dim('    3. Tag your first release: git tag v1.0.0\n'));
}

export async function initCommand() {
  console.log(pc.bold('\n  climaybe — Shopify CI/CD Setup\n'));

  const existing = readConfig();
  const alreadyInited = existing?.stores && Object.keys(existing.stores).length > 0;

  if (alreadyInited) {
    const { reinit } = await prompts({
      type: 'confirm',
      name: 'reinit',
      message: 'This repo already has a climaybe config. Reinitialize? This will remove your current stores and workflow settings.',
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
