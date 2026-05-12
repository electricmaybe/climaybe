import pc from 'picocolors';
import { readConfig, getMode, getProjectType, getStoreAliases, writeConfig, getAliasForDefaultStore } from './config.js';
import { rootToStores, storesToRoot } from './store-sync.js';
import { promptServeStore } from './prompts.js';

function readExplicitServeAlias(cwd) {
  const raw = process.env.CLIMAYBE_SERVE_STORE?.trim();
  if (!raw) return { ok: true, alias: null };
  const aliases = getStoreAliases(cwd);
  if (aliases.includes(raw)) return { ok: true, alias: raw };
  console.log(pc.red(`  CLIMAYBE_SERVE_STORE="${raw}" is not a known store alias.`));
  console.log(pc.dim(`  Available: ${aliases.join(', ')}\n`));
  return { ok: false, alias: null };
}

function isNonInteractiveServe() {
  if (process.env.CLIMAYBE_SERVE_STORE?.trim()) return true;
  if (process.env.CI === 'true') return true;
  return process.stdin.isTTY !== true;
}

/**
 * In multi-store theme repos, ensure root JSONs and `default_store` match the store
 * the user wants to serve. If the choice differs from the previous switch target,
 * saves current root → `stores/<previous>/` then loads `stores/<selected>/` → root.
 *
 * @param {string} [cwd]
 * @returns {Promise<boolean>} False if the user cancelled or `CLIMAYBE_SERVE_STORE` is invalid.
 */
export async function prepareMultiStoreForServe(cwd = process.cwd()) {
  if (getProjectType(cwd) === 'app') return true;
  if (getMode(cwd) !== 'multi') return true;

  const config = readConfig(cwd);
  if (!config?.stores || typeof config.stores !== 'object') return true;

  const aliases = getStoreAliases(cwd);
  if (aliases.length < 2) return true;

  const stores = config.stores;
  const suggestedAlias = getAliasForDefaultStore(cwd) ?? aliases[0];

  const explicit = readExplicitServeAlias(cwd);
  if (!explicit.ok) return false;

  let selected = explicit.alias;
  if (!selected) {
    if (isNonInteractiveServe()) {
      selected = suggestedAlias;
    } else {
      console.log(pc.bold('\n  climaybe — serve (store)\n'));
      selected = await promptServeStore({ aliases, stores, suggestedAlias });
      if (!selected) {
        console.log(pc.dim('  Cancelled.\n'));
        return false;
      }
    }
  }

  const previousAlias = getAliasForDefaultStore(cwd);

  if (selected === previousAlias) return true;

  if (previousAlias) {
    rootToStores(previousAlias, cwd);
  } else {
    console.log(
      pc.yellow(
        '  Warning: default_store did not match any store alias; current root JSONs are not auto-saved to a store folder.'
      )
    );
  }

  const ok = storesToRoot(selected, cwd);
  if (!ok) return false;

  const domain = stores[selected];
  if (domain) writeConfig({ default_store: domain }, cwd);

  return true;
}
