import prompts from 'prompts';
import pc from 'picocolors';
import { execSync } from 'node:child_process';
import {
  promptStoreLoop,
  promptPreviewWorkflows,
  promptBuildWorkflows,
  promptLighthouseWorkflows,
  promptDevKit,
  promptVSCodeDevTasks,
  promptProjectName,
  promptCommitlint,
  promptBranchProtection,
  promptCursorSkills,
  promptAiEditors,
  promptConfigureCISecrets,
  promptNoRemoteAction,
  promptOwnerRepo,
  promptUpdateExistingSecrets,
  promptSecretValue,
} from '../lib/prompts.js';
import { readConfig, writeConfig, getProjectType, readPkg } from '../lib/config.js';
import { ensureGitRepo, ensureInitialCommit, ensureStagingBranch, createStoreBranches, getSuggestedTagForRelease, addOriginRemote } from '../lib/git.js';
import { scaffoldWorkflows } from '../lib/workflows.js';
import { createStoreDirectories } from '../lib/store-sync.js';
import { scaffoldCommitlint } from '../lib/commit-tooling.js';
import { scaffoldAiConfig, logAiConfigResult } from '../lib/cursor-bundle.js';
import { getMissingBuildWorkflowRequirements, ensureBuildWorkflowDefaults } from '../lib/build-workflows.js';
import { getDevKitExistingFiles, scaffoldThemeDevKit } from '../lib/theme-dev-kit.js';
import {
  isGhAvailable,
  hasGitHubRemote,
  isGlabAvailable,
  hasGitLabRemote,
  listGitHubSecrets,
  listGitLabVariables,
  getStoreUrlSecretsFromConfig,
  getSecretsToPrompt,
  getStoreUrlForThemeTokenSecret,
  validateThemeAccessToken,
  setSecret,
  setGitLabVariable,
} from '../lib/github-secrets.js';
import { logBranchProtectionResult, syncBranchProtection } from '../lib/branch-protection.js';

function installThemeDependencies(cwd = process.cwd()) {
  try {
    execSync('npm install', { cwd, stdio: 'inherit' });
    console.log(pc.green('  Installed theme dependencies (npm install).'));
    return true;
  } catch (err) {
    console.log(pc.yellow(`  npm install failed or skipped: ${err.message}`));
    return false;
  }
}

const DOCS_BASE = 'https://github.com/electricmaybe/climaybe#';

/**
 * Print a dim one-line helper under a prompt, with an optional docs anchor link.
 * Keeps prompt labels short while still explaining what each answer is for.
 * @param {string} text - one sentence, what the answer is for / what it should look like
 * @param {string} [anchor] - README heading anchor (e.g. 'theme-dev-kit')
 */
function hint(text, anchor) {
  console.log(pc.dim(`  ↳ ${text}`));
  if (anchor) console.log(pc.dim(`    docs: ${DOCS_BASE}${anchor}`));
}

/**
 * Run the full init flow: prompts, config write, git, branches, workflows.
 * Used by both init (when not already inited or user confirms reinit) and reinit.
 */
async function runInitFlow() {
  const hasPackageJson = !!readPkg();
  let projectName;
  if (!hasPackageJson) {
    hint("Used only when this repo has no package.json yet — the repo/folder name is usually fine.");
    projectName = await promptProjectName();
  }

  // 1. Collect stores from user
  hint('Enter a Shopify subdomain (e.g. voldt-staging) or full domain; add 2+ stores for multi-store mode.');
  const stores = await promptStoreLoop();
  const mode = stores.length > 1 ? 'multi' : 'single';

  hint('CI that publishes a preview theme per PR and cleans it up on close.', 'preview-and-cleanup-workflows');
  const enablePreviewWorkflows = await promptPreviewWorkflows();

  hint('CI that bundles _scripts JS and compiles Tailwind on push. Yes if the theme uses _scripts/_styles.', 'build-and-lighthouse-workflows');
  const enableBuildWorkflows = await promptBuildWorkflows();

  let enableLighthouseWorkflows = false;
  if (enableBuildWorkflows) {
    hint('Runs Lighthouse performance + a11y budgets on the staging branch (inside the build pipeline).', 'build-and-lighthouse-workflows');
    enableLighthouseWorkflows = await promptLighthouseWorkflows();
  }

  hint('Local config + ignore defaults for theme work (Theme Check, Prettier, Lighthouse, gitignore).', 'theme-dev-kit');
  const enableDevKit = await promptDevKit();
  let enableVSCodeTasks = false;
  if (enableDevKit) {
    hint('Adds a VS Code task that runs `climaybe serve`. Only useful if you use VS Code.');
    enableVSCodeTasks = await promptVSCodeDevTasks();
  }

  hint('Checks commit messages locally so they follow conventional commits (feat:, fix:, …).');
  const enableCommitlint = await promptCommitlint();

  hint('Requires PRs on production branches (main, or each live-<alias>). Skips cleanly without GitHub/gh.', 'branch-protection');
  const enableBranchProtection = await promptBranchProtection();

  hint('Electric Maybe rules/skills/subagents installed to a single .config/ai/ source of truth.', 'ai-ruleset');
  const enableCursorSkills = await promptCursorSkills();
  let aiEditors = [];
  if (enableCursorSkills) {
    hint('Pick the editors to bridge to .config/ai/ — only the ones you select get a bridge file.', 'ai-ruleset');
    aiEditors = await promptAiEditors();
  }

  console.log(pc.dim(`\n  Mode: ${mode}-store (${stores.length} store(s))`));

  let missingBuildFiles = [];
  if (enableBuildWorkflows) {
    ensureBuildWorkflowDefaults();
    missingBuildFiles = getMissingBuildWorkflowRequirements();
    if (missingBuildFiles.length > 0) {
      console.log(pc.red('\n  Build workflows are enabled, but required files are missing:'));
      for (const req of missingBuildFiles) {
        const expected = req.kind === 'dir' ? `${req.path}/` : req.path;
        console.log(pc.red(`    - ${expected}`));
      }
      console.log(pc.dim('\n  Build workflows will be scaffolded, but build steps will be skipped until entrypoints exist.'));
      const { createNow } = await prompts({
        type: 'confirm',
        name: 'createNow',
        message: 'Create _scripts/main.js and _styles/main.css now?',
        initial: false,
      });
      if (createNow) {
        // Lazy import to avoid circular deps and keep init lean.
        const { createEntrypointsCommand } = await import('./create-entrypoints.js');
        await createEntrypointsCommand();
      } else {
        console.log(pc.dim('  Skipping entrypoint creation (default).'));
      }
    }
  }

  // 2. Build config
  const config = {
    project_type: 'theme',
    port: 9295,
    default_store: stores[0].domain,
    preview_workflows: enablePreviewWorkflows,
    build_workflows: enableBuildWorkflows,
    lighthouse_workflows: enableBuildWorkflows ? enableLighthouseWorkflows : undefined,
    build_entrypoints_ready: enableBuildWorkflows ? missingBuildFiles?.length === 0 : undefined,
    dev_kit: enableDevKit,
    vscode_tasks: enableVSCodeTasks,
    commitlint: enableCommitlint,
    cursor_skills: enableCursorSkills,
    ai_editors: enableCursorSkills ? aiEditors : undefined,
    stores: {},
  };

  for (const s of stores) {
    config.stores[s.alias] = s.domain;
  }

  // 3. Write climaybe config
  writeConfig(config);
  console.log(pc.green('  Updated climaybe config.'));

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

  if (enableBranchProtection) {
    const protection = syncBranchProtection({
      mode,
      aliases: stores.map((s) => s.alias),
      cwd: process.cwd(),
    });
    logBranchProtectionResult(protection, mode);
    if (protection.applied.length > 0 || protection.removed.length > 0) {
      console.log(
        pc.dim(
          '  Rule: PR required on protected branches; live-* bypass allowed for shopify[bot], github-actions[bot], actions-user.'
        )
      );
    }
  } else {
    console.log(pc.dim('  Branch protection: skipped (declined at prompt).'));
  }

  // 6. Scaffold workflows
  scaffoldWorkflows(mode, {
    includePreview: enablePreviewWorkflows,
    includeBuild: enableBuildWorkflows,
  });

  // 7. Optional commitlint + Husky and the AI ruleset (rules, skills, agents + editor bridges)
  if (enableCommitlint) {
    console.log(pc.dim('  Setting up commitlint + Husky...'));
    if (scaffoldCommitlint()) {
      console.log(pc.green('  commitlint + Husky installed (conventional commits enforced on git commit).'));
    } else {
      console.log(pc.yellow('  commitlint setup failed or skipped (run npm install manually).'));
    }
  }
  if (enableCursorSkills) {
    const aiResult = scaffoldAiConfig(process.cwd(), { editors: aiEditors });
    logAiConfigResult(aiResult, { pc });
  }

  if (enableDevKit) {
    const existing = getDevKitExistingFiles({ includeVSCodeTasks: enableVSCodeTasks });
    if (existing.length > 0) {
      console.log(pc.yellow('  Theme dev kit will replace existing files:'));
      for (const path of existing) console.log(pc.yellow(`    - ${path}`));
    }
    scaffoldThemeDevKit({
      includeVSCodeTasks: enableVSCodeTasks,
      defaultStoreDomain: stores[0]?.domain || '',
      packageName: projectName || undefined,
    });
    console.log(pc.green('  Theme dev kit installed (local config + ignore defaults).'));
    installThemeDependencies();
  }

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
  if (enableBuildWorkflows) {
    console.log(pc.dim(`  Lighthouse CI: ${enableLighthouseWorkflows ? 'enabled' : 'disabled'}`));
  }
  console.log(pc.dim(`  Theme dev kit: ${enableDevKit ? 'enabled' : 'disabled'}`));
  if (enableDevKit) {
    console.log(pc.dim(`  VS Code tasks: ${enableVSCodeTasks ? 'enabled' : 'disabled'}`));
  }
  console.log(pc.dim(`  commitlint + Husky: ${enableCommitlint ? 'enabled' : 'disabled'}`));
  console.log(
    pc.dim(
      `  AI ruleset: ${enableCursorSkills ? `installed (${aiEditors.join(', ') || 'cursor'})` : 'skipped'}`
    )
  );

  const suggestedTag = getSuggestedTagForRelease();
  const tagLabel = suggestedTag === 'v1.0.0' ? 'Tag your first release' : 'Tag your next release';
  console.log(pc.dim('\n  Next steps:'));
  console.log(pc.dim('    1. Add GEMINI_API_KEY to your CI secrets (or configure below)'));
  console.log(pc.dim('    2. Push to GitHub/GitLab and start using the branching workflow'));
  console.log(pc.dim(`    3. ${tagLabel}: git tag ${suggestedTag}\n`));

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
    console.log(
      pc.yellow(
        ciHost === 'github'
          ? '  GitHub CLI is not available (tried gh and npx gh) or not logged in.'
          : `  ${setter.name} CLI is not installed or not logged in.`
      )
    );
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
    console.log(pc.yellow(`  This folder has no ${setter.name} "origin" remote yet.`));
    const action = await promptNoRemoteAction(setter.name);
    if (action !== 'add') {
      console.log(pc.dim('  Skipping CI secrets. Add a remote later, then re-run "climaybe init" or set them in the repo Settings.\n'));
      return;
    }
    const slug = await promptOwnerRepo(setter.name);
    if (!slug) {
      console.log(pc.dim('  No repository entered; skipping CI secrets for now.\n'));
      return;
    }
    try {
      const url = addOriginRemote(slug, ciHost, process.cwd());
      console.log(pc.green(`  Added origin → ${url}`));
      console.log(pc.dim('  Create the repo on ' + setter.name + ' and "git push -u origin --all" when ready.'));
    } catch (err) {
      console.log(pc.red(`  Could not add origin remote: ${err.message}`));
      console.log(pc.dim('  Add it manually with "git remote add origin <url>", then re-run "climaybe init".\n'));
      return;
    }
    if (!setter.checkRemote()) {
      console.log(pc.dim('  Remote added, but it is not recognized as a ' + setter.name + ' URL; skipping CI secrets.\n'));
      return;
    }
  }

  const existingNames =
    ciHost === 'github' ? listGitHubSecrets() : listGitLabVariables();
  const namesWeWillPrompt = new Set(secretsToPrompt.map((s) => s.name));
  const alreadySet = new Set(existingNames.filter((n) => namesWeWillPrompt.has(n)));
  let doUpdateExisting = true;
  if (alreadySet.size > 0) {
    doUpdateExisting = await promptUpdateExistingSecrets([...alreadySet]);
    if (!doUpdateExisting) {
      console.log(pc.dim('\n  Skipping only the secret(s) already set; will still prompt for the rest.\n'));
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
    if (alreadySet.has(name) && !doUpdateExisting) continue;
    try {
      await setter.set(name, value);
      console.log(pc.green(`  Set ${name} (from store config).`));
      setCount++;
    } catch (err) {
      console.log(pc.red(`  Failed to set ${name}: ${err.message}`));
    }
  }

  const toPrompt = secretsToPrompt.filter((s) => !alreadySet.has(s.name) || doUpdateExisting);
  const totalToPrompt = toPrompt.length;
  console.log(pc.cyan(`\n  Configure ${totalToPrompt} ${setter.name} secret(s)/variable(s). Leave optional ones blank to skip.\n`));
  for (let i = 0; i < toPrompt.length; i++) {
    const secret = toPrompt[i];
    const isThemeToken =
      secret.name === 'SHOPIFY_THEME_ACCESS_TOKEN' || secret.name.startsWith('SHOPIFY_THEME_ACCESS_TOKEN_');
    const storeUrl = isThemeToken ? getStoreUrlForThemeTokenSecret(secret.name, stores) : null;

    if (isThemeToken) {
      if (!storeUrl) {
        console.log(pc.yellow(`  Could not resolve store URL for ${secret.name}, skipping token validation.`));
      }
      // Theme tokens are optional during setup; if provided, keep prompting until valid + set.
      while (true) {
        const value = await promptSecretValue(secret, i, totalToPrompt);
        if (!value) {
          console.log(pc.dim(`  Skipped ${secret.name}.`));
          break;
        }
        if (storeUrl) {
          const result = await validateThemeAccessToken(storeUrl, value);
          if (!result.ok) {
            console.log(pc.red(`  Token test failed: ${result.error}`));
            console.log(pc.dim('  Enter a valid token, or leave blank to skip.'));
            continue;
          }
          console.log(pc.green('  Token validated against store.'));
        }
        try {
          await setter.set(secret.name, value);
          console.log(pc.green(`  Set ${secret.name}.`));
          setCount++;
          break;
        } catch (err) {
          console.log(pc.red(`  Failed to set ${secret.name}: ${err.message}`));
          console.log(pc.dim('  Enter again to retry, or leave blank to skip.'));
        }
      }
      continue;
    }

    const value = await promptSecretValue(secret, i, totalToPrompt);
    if (!value) continue;

    try {
      await setter.set(secret.name, value);
      console.log(pc.green(`  Set ${secret.name}.`));
      setCount++;
    } catch (err) {
      console.log(pc.red(`  Failed to set ${secret.name}: ${err.message}`));
    }
  }
  if (setCount > 0) {
    console.log(pc.green(`\n  Done. ${setCount} secret(s) set for this repository.\n`));
  }
}

export async function initCommand() {
  console.log(pc.bold('\n  climaybe — Shopify theme CI/CD setup\n'));

  if (getProjectType() === 'app') {
    console.log(pc.red('  This repo is configured as a Shopify app (project_type: app).'));
    console.log(pc.dim('  Use: npx climaybe app init'));
    console.log(pc.dim('  To switch to theme CI/CD, remove or edit climaybe.config.json → project_type first.\n'));
    return;
  }

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
      console.log(pc.dim('  Use "climaybe theme add-store" (or "climaybe add-store") to add more stores.'));
      console.log(pc.dim('  Use "climaybe theme update-workflows" (or "climaybe update-workflows") to refresh workflows.'));
      console.log(pc.dim('  Use "climaybe theme reinit" (or "climaybe reinit") to reinitialize from scratch.\n'));
      return;
    }
  }

  await runInitFlow();
}

export async function reinitCommand() {
  console.log(pc.bold('\n  climaybe — Reinitialize theme CI/CD setup\n'));

  if (getProjectType() === 'app') {
    console.log(pc.red('  This repo is a Shopify app (project_type: app).'));
    console.log(pc.dim('  Use: npx climaybe app init\n'));
    return;
  }

  await runInitFlow();
}
