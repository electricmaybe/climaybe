import { serveAll, serveShopify } from '../lib/dev-runtime.js';
import { prepareServeStore } from '../lib/serve-store.js';
import { requireThemeProject } from '../lib/theme-guard.js';

export async function serveCommand(opts = {}) {
  if (!requireThemeProject()) return;
  const selection = await prepareServeStore({ alias: opts.alias });
  if (!selection) return;
  return serveAll({ includeThemeCheck: opts.themeCheck === true, store: selection.domain });
}

export async function serveShopifyCommand(opts = {}) {
  if (!requireThemeProject()) return;
  const selection = await prepareServeStore({ alias: opts.alias });
  if (!selection) return;
  return serveShopify({ store: selection.domain });
}

