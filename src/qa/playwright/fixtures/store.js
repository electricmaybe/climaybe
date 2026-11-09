import { test as base, expect } from '@playwright/test';
import { loadQaConfig, resolveStoreFixtures } from '../../lib/config-loader.js';

/**
 * Attach console + network listeners; expose fixtures from qa/config.yml.
 */
export const test = base.extend({
  qaFixtures: async ({}, use) => {
    const { config } = loadQaConfig(process.env.QA_THEME_ROOT || process.cwd());
    const fixtures = resolveStoreFixtures(config || {}, process.env.QA_STORE_ALIAS);
    await use(fixtures);
  },

  consoleErrors: async ({ page, qaFixtures }, use) => {
    /** @type {string[]} */
    const errors = [];
    const allow = (qaFixtures.thirdPartyAllowlist || []).map((s) => String(s).toLowerCase());

    const isThemeRelevant = (text, location) => {
      const blob = `${text} ${location || ''}`.toLowerCase();
      if (allow.some((a) => blob.includes(a))) return false;
      // Prefer failing on theme asset / inline theme script sources
      if (blob.includes('/cdn/shop/') || blob.includes('shopifycloud.com')) return false;
      return true;
    };

    page.on('pageerror', (err) => {
      const msg = err?.message || String(err);
      if (isThemeRelevant(msg)) errors.push(`pageerror: ${msg}`);
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      const loc = msg.location()?.url || '';
      if (isThemeRelevant(text, loc)) errors.push(`console: ${text}`);
    });
    page.on('response', (res) => {
      const status = res.status();
      if (status < 400) return;
      const url = res.url();
      if (!isThemeRelevant(url, url)) return;
      if (/\.(png|jpe?g|gif|webp|svg|css|js)(\?|$)/i.test(url) || /\/cart\//.test(url)) {
        errors.push(`network ${status}: ${url}`);
      }
    });

    await use(errors);
  },
});

export { expect };

/**
 * Navigate to a product path on the preview base.
 * @param {import('@playwright/test').Page} page
 * @param {string} path
 */
export async function gotoPath(page, path) {
  const base = process.env.PLAYWRIGHT_BASE_URL || process.env.QA_PREVIEW_URL || '';
  const url = path.startsWith('http') ? path : `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

/**
 * Rough z-index / overlay check: primary ATC center must not be covered by sticky chrome.
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
export async function assertNotCovered(page, selector) {
  const handle = page.locator(selector).first();
  if ((await handle.count()) === 0) return { skipped: true };
  const box = await handle.boundingBox();
  if (!box) return { skipped: true };
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const top = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      return {
        tag: el.tagName,
        id: el.id,
        className: typeof el.className === 'string' ? el.className : '',
      };
    },
    { x, y }
  );
  return { skipped: false, point: { x, y }, top };
}
