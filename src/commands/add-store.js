import pc from 'picocolors';
import { promptNewStore, promptConfigureCISecrets, promptUpdateExistingSecrets, promptSecretValue, promptTestThemeToken } from '../lib/prompts.js';
import { readConfig, addStoreToConfig, getStoreAliases, getMode, isPreviewWorkflowsEnabled, isBuildWorkflowsEnabled } from '../lib/config.js';
import { createStoreBranches } from '../lib/git.js';
import { scaffoldWorkflows } from '../lib/workflows.js';
import { createStoreDirectories } from '../lib/store-sync.js';
import {
  isGhAvailable,
  hasGitHubRemote,
  isGlabAvailable,
  hasGitLabRemote,
  listGitHubSecrets,
  listGitLabVariables,
  getStoreUrlSecretForNewStore,
  getSecretsToPromptForNewStore,
  validateThemeAccessToken,
  setSecret,
  setGitLabVariable,
} from '../lib/github-secrets.js';

export async function addStoreCommand() {
  console.log(pc.bold('\n  climaybe — Add Store\n'));

  // Guard: config must exist
  const config = readConfig();
  if (!config?.stores) {
    console.log(pc.red('  No climaybe config found. Run "climaybe init" first.\n'));
    return;
  }

  const existingAliases = getStoreAliases();
  const previousMode = getMode();
  const includePreview = isPreviewWorkflowsEnabled();
  const includeBuild = isBuildWorkflowsEnabled();

  // Prompt for new store
  const store = await promptNewStore(existingAliases);
  if (!store) return;

  // Add to config
  addStoreToConfig(store.alias, store.domain);
  console.log(pc.green(`  Added store: ${store.alias} → ${store.domain}`));

  const newMode = getMode();

  // Create store branches + directories
  createStoreBranches(store.alias);
  createStoreDirectories(store.alias);

  // Handle single → multi migration
  if (previousMode === 'single' && newMode === 'multi') {
    console.log(pc.cyan('\n  Migrating from single-store to multi-store mode...'));

    // Create branches for the original store too
    const originalAlias = existingAliases[0];
    createStoreBranches(originalAlias);
    createStoreDirectories(originalAlias);

    // Re-scaffold workflows for multi mode
    scaffoldWorkflows('multi', { includePreview, includeBuild });
    console.log(pc.green('  Migration complete — workflows updated to multi-store mode.'));
  } else if (newMode === 'multi') {
    // Already multi, just make sure workflows are current
    scaffoldWorkflows('multi', { includePreview, includeBuild });
  }

  console.log(pc.bold(pc.green('\n  Store added successfully!\n')));
  console.log(pc.dim(`  New branches: staging-${store.alias}, live-${store.alias}`));
  console.log(pc.dim(`  Store dir: stores/${store.alias}/\n`));

  // If preview workflows are on, offer to set this store's CI secrets (multi-store uses per-store secrets)
  if (includePreview) {
    const ciHost = await promptConfigureCISecrets();
    if (ciHost !== 'skip') {
      const setter =
        ciHost === 'github'
          ? { check: isGhAvailable, checkRemote: hasGitHubRemote, set: setSecret, name: 'GitHub' }
          : { check: isGlabAvailable, checkRemote: hasGitLabRemote, set: setGitLabVariable, name: 'GitLab' };

      if (!setter.check()) {
        console.log(pc.yellow(`  ${setter.name} CLI is not installed or not logged in. Add secrets manually in repo Settings.`));
      } else if (!setter.checkRemote()) {
        console.log(pc.yellow('  No ' + setter.name + ' remote (origin). Add secrets manually after pushing.'));
      } else {
        let setCount = 0;
        const { name: urlName, value: urlValue } = getStoreUrlSecretForNewStore(store);
        try {
          await setter.set(urlName, urlValue);
          console.log(pc.green(`  Set ${urlName} (from store config).`));
          setCount++;
        } catch (err) {
          console.log(pc.red(`  Failed to set ${urlName}: ${err.message}`));
        }

        const secretsToPrompt = getSecretsToPromptForNewStore(store);
        const existingNames = ciHost === 'github' ? listGitHubSecrets() : listGitLabVariables();
        const namesWeWillPrompt = new Set(secretsToPrompt.map((s) => s.name));
        const alreadySet = existingNames.filter((n) => namesWeWillPrompt.has(n));
        if (alreadySet.length > 0) {
          const doUpdate = await promptUpdateExistingSecrets(alreadySet);
          if (!doUpdate) {
            if (setCount > 0) {
              console.log(pc.green(`\n  Done. ${setCount} secret(s) set for store "${store.alias}".\n`));
            }
            return;
          }
        }
        const total = secretsToPrompt.length;
        console.log(pc.cyan(`\n  Configure ${total} secret(s) for store "${store.alias}" (theme token required).\n`));
        for (let i = 0; i < secretsToPrompt.length; i++) {
          const secret = secretsToPrompt[i];
          const value = await promptSecretValue(secret, i, total);
          if (!value) continue;

          const isThemeToken = secret.name === 'SHOPIFY_THEME_ACCESS_TOKEN' || secret.name.startsWith('SHOPIFY_THEME_ACCESS_TOKEN_');
          if (isThemeToken && store.domain) {
            const doTest = await promptTestThemeToken();
            if (doTest) {
              const result = await validateThemeAccessToken(store.domain, value);
              if (!result.ok) {
                console.log(pc.red(`  Token test failed: ${result.error}`));
                console.log(pc.dim('  Secret not set. You can add it later in repo Settings → Secrets.'));
                continue;
              }
              console.log(pc.green('  Token validated against store.'));
            }
          }

          try {
            await setter.set(secret.name, value);
            console.log(pc.green(`  Set ${secret.name}.`));
            setCount++;
          } catch (err) {
            console.log(pc.red(`  Failed to set ${secret.name}: ${err.message}`));
          }
        }
        if (setCount > 0) {
          console.log(pc.green(`\n  Done. ${setCount} secret(s) set for store "${store.alias}".\n`));
        }
      }
    }
  }
}
