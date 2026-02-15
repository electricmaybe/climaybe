import pc from 'picocolors';
import { getStoreAliases, getMode, readConfig } from '../lib/config.js';
import { rootToStores } from '../lib/store-sync.js';

export async function syncCommand(alias) {
  console.log(pc.bold('\n  climaybe — Sync to Store\n'));

  const mode = getMode();
  if (mode !== 'multi') {
    console.log(pc.yellow('  Sync is only available in multi-store mode.\n'));
    return;
  }

  const aliases = getStoreAliases();

  // If no alias provided, use default store
  if (!alias) {
    const config = readConfig();
    const defaultDomain = config?.default_store;
    // Find alias by domain
    alias = aliases.find((a) => config.stores[a] === defaultDomain);

    if (!alias) {
      console.log(pc.red('  No alias provided and no default store found.'));
      console.log(pc.dim(`  Usage: climaybe sync <alias>`));
      console.log(pc.dim(`  Available: ${aliases.join(', ')}\n`));
      return;
    }
    console.log(pc.dim(`  Using default store: ${alias}`));
  }

  if (!aliases.includes(alias)) {
    console.log(pc.red(`  Unknown store alias: "${alias}"`));
    console.log(pc.dim(`  Available: ${aliases.join(', ')}\n`));
    return;
  }

  const ok = rootToStores(alias);
  if (ok) {
    console.log(pc.bold(pc.green(`\n  Synced root → stores/${alias}/\n`)));
  }
}
