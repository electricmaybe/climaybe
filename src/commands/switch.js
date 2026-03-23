import pc from 'picocolors';
import { getStoreAliases, getMode } from '../lib/config.js';
import { storesToRoot } from '../lib/store-sync.js';
import { requireThemeProject } from '../lib/theme-guard.js';

export async function switchCommand(alias) {
  console.log(pc.bold('\n  climaybe — Switch Store\n'));

  if (!requireThemeProject()) return;

  const mode = getMode();
  if (mode !== 'multi') {
    console.log(pc.yellow('  Switch is only available in multi-store mode.\n'));
    return;
  }

  const aliases = getStoreAliases();
  if (!aliases.includes(alias)) {
    console.log(pc.red(`  Unknown store alias: "${alias}"`));
    console.log(pc.dim(`  Available: ${aliases.join(', ')}\n`));
    return;
  }

  const ok = storesToRoot(alias);
  if (ok) {
    console.log(pc.bold(pc.green(`\n  Switched to store: ${alias}\n`)));
    console.log(pc.dim('  Root JSON files now reflect this store\'s data.'));
    console.log(pc.dim('  Use "climaybe theme sync" (or "climaybe sync") to write changes back.\n'));
  }
}
