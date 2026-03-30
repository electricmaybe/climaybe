import pc from 'picocolors';
import { getActiveStoreAlias, getMode, getStoreAliases, readConfig, setActiveStoreAlias } from './config.js';
import { promptStoreAliasSelection } from './prompts.js';
import { storesToRoot } from './store-sync.js';

function resolveSingleStoreDomain(config) {
  if (config?.default_store) return config.default_store;
  if (config?.store) return config.store;
  return Object.values(config?.stores || {})[0] || '';
}

export async function prepareServeStore({ cwd = process.cwd(), alias = '' } = {}) {
  const config = readConfig(cwd) || {};
  const mode = getMode(cwd);

  if (mode !== 'multi') {
    return { alias: null, domain: resolveSingleStoreDomain(config) };
  }

  const aliases = getStoreAliases(cwd);
  if (alias && !aliases.includes(alias)) {
    console.log(pc.red(`  Unknown store alias: "${alias}"`));
    console.log(pc.dim(`  Available: ${aliases.join(', ')}\n`));
    return null;
  }

  let selectedAlias = alias || getActiveStoreAlias(cwd);

  if (selectedAlias && !aliases.includes(selectedAlias)) {
    console.log(pc.yellow(`  Saved active store alias "${selectedAlias}" is not in config anymore.`));
    selectedAlias = '';
  }

  if (!selectedAlias) {
    selectedAlias = await promptStoreAliasSelection(aliases, 'Which store do you want to serve?');
    if (!selectedAlias) return null;
  }

  if (!aliases.includes(selectedAlias)) {
    console.log(pc.red(`  Unknown store alias: "${selectedAlias}"`));
    console.log(pc.dim(`  Available: ${aliases.join(', ')}\n`));
    return null;
  }

  const ok = storesToRoot(selectedAlias, cwd);
  if (!ok) return null;

  setActiveStoreAlias(selectedAlias, cwd);
  console.log(pc.dim(`  Using store: ${selectedAlias}`));
  return { alias: selectedAlias, domain: config?.stores?.[selectedAlias] || '' };
}

