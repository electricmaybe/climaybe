import pc from 'picocolors';
import { promptNewStore } from '../lib/prompts.js';
import { readConfig, addStoreToConfig, getStoreAliases, getMode } from '../lib/config.js';
import { createStoreBranches } from '../lib/git.js';
import { scaffoldWorkflows } from '../lib/workflows.js';
import { createStoreDirectories } from '../lib/store-sync.js';

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
    scaffoldWorkflows('multi');
    console.log(pc.green('  Migration complete — workflows updated to multi-store mode.'));
  } else if (newMode === 'multi') {
    // Already multi, just make sure workflows are current
    scaffoldWorkflows('multi');
  }

  console.log(pc.bold(pc.green('\n  Store added successfully!\n')));
  console.log(pc.dim(`  New branches: staging-${store.alias}, live-${store.alias}`));
  console.log(pc.dim(`  Store dir: stores/${store.alias}/\n`));
}
