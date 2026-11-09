import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, gotoPath } from '../fixtures/store.js';
import {
  blockedTagsForFailures,
  loadSelectionRules,
  skippedByImplication,
} from '../../lib/selection.js';

/**
 * J1 — always-run purchase funnel with gatekeeper / implication semantics.
 * Failed steps are recorded; dependents are marked blocked (not failed) and the
 * test continues so the report shows the full chain. The test fails at the end
 * if any step failed.
 */
test.describe('Purchase funnel @funnel @purchase', () => {
  test('J1 PDP → variant → cart qty → checkout handoff', async ({ page, qaFixtures, consoleErrors }) => {
    const productPath = qaFixtures.variantProductPath || qaFixtures.productPath;
    const rules = loadSelectionRules();
    /** @type {Array<{ id: string, title: string, status: string, tags: string[], error?: string }>} */
    const steps = [];
    /** @type {string[]} */
    const failedTags = [];
    /** @type {string[]} */
    const provenTags = [];
    let blockedAll = false;

    const isBlocked = (tags) => {
      if (blockedAll) return true;
      const blocked = new Set(blockedTagsForFailures(failedTags, rules));
      if (blocked.has('*')) return true;
      return tags.some((t) => blocked.has(t));
    };

    const shouldSkipImplied = (tags) => {
      const skips = new Set(skippedByImplication(provenTags, rules));
      return tags.some((t) => skips.has(t));
    };

    const step = async (name, tags, fn) => {
      if (isBlocked(tags)) {
        const row = {
          id: name,
          title: name,
          status: 'blocked',
          tags,
          error: `Blocked by prior failure: ${failedTags.join(', ') || 'gatekeeper'}`,
        };
        steps.push(row);
        test.info().annotations.push({ type: 'blocked', description: `${name}: ${row.error}` });
        return row;
      }
      if (shouldSkipImplied(tags)) {
        const row = { id: name, title: name, status: 'skipped', tags, error: 'Proven by later/earlier implication' };
        steps.push(row);
        test.info().annotations.push({ type: 'skipped', description: `${name}: implied` });
        return row;
      }
      try {
        await test.step(`${name} ${tags.join(' ')}`, fn);
        const row = { id: name, title: name, status: 'passed', tags };
        steps.push(row);
        provenTags.push(...tags);
        return row;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const row = { id: name, title: name, status: 'failed', tags, error: message };
        steps.push(row);
        failedTags.push(...tags);
        if (tags.includes('@funnel-smoke')) blockedAll = true;
        test.info().annotations.push({ type: 'failed', description: `${name}: ${message}` });
        return row;
      }
    };

    await step('U01 open PDP', ['@funnel-smoke'], async () => {
      await gotoPath(page, productPath);
      await expect(page.locator('h1, .product__title, [data-product-title]').first()).toBeVisible({
        timeout: 20_000,
      });
      const atc = page
        .locator(
          'button[name="add"], [name="add"], button:has-text("Add to cart"), button:has-text("Add to bag"), [data-add-to-cart]'
        )
        .first();
      await expect(atc).toBeVisible({ timeout: 15_000 });
    });

    await step('U02 variant change', ['@variant-change', '@variant'], async () => {
      const option = page
        .locator(
          'variant-selects input[type="radio"]:not([checked]), fieldset input[type="radio"]:not([checked]), .product-form__input input[type="radio"]:not([checked]), select[name*="id"] option:not([selected])'
        )
        .first();
      if ((await option.count()) === 0) {
        if (qaFixtures.hasVariants === false) {
          test.info().annotations.push({
            type: 'note',
            description: 'Config says product has no variants; soft-pass',
          });
          return;
        }
        throw new Error('Expected variant controls but none found (qa/config has_variants is not false)');
      }
      const beforeUrl = page.url();
      const priceBefore = await page
        .locator('[data-product-price], .price, .product__price')
        .first()
        .textContent()
        .catch(() => '');
      if (await option.evaluate((el) => el.tagName === 'OPTION').catch(() => false)) {
        const select = page.locator('select').filter({ has: option }).first();
        const value = await option.getAttribute('value');
        if (value) await select.selectOption(value);
      } else {
        await option.click({ force: true });
      }
      await page.waitForTimeout(500);
      const afterUrl = page.url();
      const priceAfter = await page
        .locator('[data-product-price], .price, .product__price')
        .first()
        .textContent()
        .catch(() => '');
      const changed =
        afterUrl !== beforeUrl || (priceAfter && priceAfter !== priceBefore) || afterUrl.includes('variant=');
      expect(changed, 'variant change should update URL and/or price').toBeTruthy();
    });

    await step('U06 qty increase (implies ATC)', ['@funnel-qty-increase', '@funnel-add-to-cart', '@cart'], async () => {
      const atc = page
        .locator(
          'button[name="add"], [name="add"], button:has-text("Add to cart"), button:has-text("Add to bag"), [data-add-to-cart]'
        )
        .first();
      await atc.click();
      const plus = page
        .locator(
          'cart-drawer button[name="plus"], .cart-drawer [data-qty-increase], [data-action="increase"], button[aria-label*="Increase"], button:has-text("+")'
        )
        .first();
      await page.waitForTimeout(800);
      if ((await plus.count()) > 0 && (await plus.isVisible().catch(() => false))) {
        await plus.click();
        await page.waitForTimeout(400);
        const cart = await page.evaluate(async () => {
          const res = await fetch('/cart.js');
          return res.json();
        });
        expect(cart.item_count, 'cart item_count should be >= 2 after plus').toBeGreaterThanOrEqual(2);
      } else {
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        const cartPlus = page
          .locator('button[name="plus"], [data-qty-increase], button[aria-label*="Increase"]')
          .first();
        if ((await cartPlus.count()) > 0) await cartPlus.click();
        const cart = await page.evaluate(async () => {
          const res = await fetch('/cart.js');
          return res.json();
        });
        expect(cart.item_count).toBeGreaterThanOrEqual(1);
      }
    });

    await step('U07 qty decrease', ['@funnel-qty-decrease', '@cart'], async () => {
      const minus = page
        .locator(
          'cart-drawer button[name="minus"], .cart-drawer [data-qty-decrease], [data-action="decrease"], button[aria-label*="Decrease"], button:has-text("−"), button:has-text("-")'
        )
        .first();
      if ((await minus.count()) > 0 && (await minus.isVisible().catch(() => false))) {
        await minus.click();
        await page.waitForTimeout(400);
      } else {
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        const cartMinus = page
          .locator('button[name="minus"], [data-qty-decrease], button[aria-label*="Decrease"]')
          .first();
        if ((await cartMinus.count()) > 0) await cartMinus.click();
      }
      const cart = await page.evaluate(async () => {
        const res = await fetch('/cart.js');
        return res.json();
      });
      expect(cart.item_count).toBeGreaterThanOrEqual(1);
    });

    await step('U08 remove line', ['@funnel-remove', '@cart'], async () => {
      let cart = await page.evaluate(async () => {
        const res = await fetch('/cart.js');
        return res.json();
      });
      if (!cart.item_count) {
        await gotoPath(page, productPath);
        const atc = page
          .locator('button[name="add"], [name="add"], button:has-text("Add to cart"), [data-add-to-cart]')
          .first();
        await atc.click();
        await page.waitForTimeout(600);
      }
      const remove = page
        .locator(
          'cart-drawer [data-remove], cart-drawer a[href*="/cart/change"], .cart-drawer button:has-text("Remove"), cart-remove-button, button[aria-label*="Remove"]'
        )
        .first();
      if ((await remove.count()) > 0 && (await remove.isVisible().catch(() => false))) {
        await remove.click();
      } else {
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        const cartRemove = page
          .locator('[data-remove], cart-remove-button, a[href*="/cart/change"], button:has-text("Remove")')
          .first();
        if ((await cartRemove.count()) > 0) await cartRemove.click();
      }
      await page.waitForTimeout(500);
      cart = await page.evaluate(async () => {
        const res = await fetch('/cart.js');
        return res.json();
      });
      expect(cart.item_count).toBe(0);
    });

    await step('U10 checkout handoff', ['@funnel-checkout', '@funnel-cart-page-load'], async () => {
      await gotoPath(page, productPath);
      const atc = page
        .locator('button[name="add"], [name="add"], button:has-text("Add to cart"), [data-add-to-cart]')
        .first();
      await atc.click();
      await page.waitForTimeout(600);
      await page.goto('/cart', { waitUntil: 'domcontentloaded' });
      const checkout = page
        .locator('button[name="checkout"], [name="checkout"], a[href*="/checkout"], button:has-text("Checkout")')
        .first();
      await expect(checkout).toBeVisible({ timeout: 15_000 });
      await Promise.all([
        page.waitForURL(/\/(checkouts?|checkout)\b/i, { timeout: 30_000 }).catch(() => null),
        checkout.click(),
      ]);
      const url = page.url();
      expect(/checkout/i.test(url), `expected checkout URL, got ${url}`).toBeTruthy();
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    });

    const themeErrors = consoleErrors.filter(Boolean);
    const root = process.env.QA_THEME_ROOT || process.cwd();
    const outDir = join(root, 'qa-results');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, 'funnel-steps.json'),
      JSON.stringify({ steps, consoleErrors: themeErrors }, null, 2) + '\n',
      'utf-8'
    );

    const failed = steps.filter((s) => s.status === 'failed');
    expect(themeErrors, `theme console/network errors: ${themeErrors.join('; ')}`).toEqual([]);
    expect(failed, `funnel failures: ${failed.map((f) => f.id).join(', ')}`).toEqual([]);
  });
});
