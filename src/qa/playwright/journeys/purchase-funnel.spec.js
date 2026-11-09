import { test, expect, gotoPath } from '../fixtures/store.js';

/**
 * J1 — always-run purchase funnel with gatekeeper / implication semantics.
 * Tags: @funnel @purchase (+ step tags for selection/grep)
 *
 * Steps proven by later steps are not re-asserted as separate tests:
 * - successful qty increase implies add-to-cart worked
 * - checkout handoff implies cart page loaded
 */
test.describe('Purchase funnel @funnel @purchase', () => {
  test('J1 PDP → variant → cart qty → checkout handoff', async ({ page, qaFixtures, consoleErrors }) => {
    const productPath = qaFixtures.variantProductPath || qaFixtures.productPath;
    /** @type {string | null} */
    let blockedReason = null;

    const step = async (name, tags, fn) => {
      if (blockedReason) {
        test.info().annotations.push({ type: 'blocked', description: `${name}: ${blockedReason}` });
        return { status: 'blocked' };
      }
      try {
        await test.step(`${name} ${tags.join(' ')}`, fn);
        return { status: 'passed' };
      } catch (err) {
        blockedReason = `${name} failed`;
        throw err;
      }
    };

    // U01 smoke
    await step('U01 open PDP', ['@funnel-smoke'], async () => {
      await gotoPath(page, productPath);
      await expect(page.locator('h1, .product__title, [data-product-title]').first()).toBeVisible({
        timeout: 20_000,
      });
      const atc = page.locator(
        'button[name="add"], [name="add"], button:has-text("Add to cart"), button:has-text("Add to bag"), [data-add-to-cart]'
      ).first();
      await expect(atc).toBeVisible({ timeout: 15_000 });
    });

    // U02 variant change (best-effort when options exist)
    await step('U02 variant change', ['@variant-change', '@variant'], async () => {
      const option = page.locator(
        'variant-selects input[type="radio"]:not([checked]), fieldset input[type="radio"]:not([checked]), .product-form__input input[type="radio"]:not([checked]), select[name*="id"] option:not([selected])'
      ).first();
      if ((await option.count()) === 0) {
        test.info().annotations.push({ type: 'note', description: 'No alternate variant control found; soft-pass' });
        return;
      }
      const beforeUrl = page.url();
      const priceBefore = await page.locator('[data-product-price], .price, .product__price').first().textContent().catch(() => '');
      if (await option.evaluate((el) => el.tagName === 'OPTION').catch(() => false)) {
        const select = page.locator('select').filter({ has: option }).first();
        const value = await option.getAttribute('value');
        if (value) await select.selectOption(value);
      } else {
        await option.click({ force: true });
      }
      await page.waitForTimeout(500);
      const afterUrl = page.url();
      const priceAfter = await page.locator('[data-product-price], .price, .product__price').first().textContent().catch(() => '');
      const changed = afterUrl !== beforeUrl || (priceAfter && priceAfter !== priceBefore) || afterUrl.includes('variant=');
      expect(changed, 'variant change should update URL and/or price').toBeTruthy();
    });

    // U05/U06 add + qty increase (qty increase proves ATC)
    await step('U06 qty increase (implies ATC)', ['@funnel-qty-increase', '@funnel-add-to-cart', '@cart'], async () => {
      const atc = page.locator(
        'button[name="add"], [name="add"], button:has-text("Add to cart"), button:has-text("Add to bag"), [data-add-to-cart]'
      ).first();
      await atc.click();
      // Prefer drawer qty plus; fall back to cart page
      const plus = page.locator(
        'cart-drawer button[name="plus"], .cart-drawer [data-qty-increase], [data-action="increase"], button[aria-label*="Increase"], button:has-text("+")'
      ).first();
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
        const cartPlus = page.locator('button[name="plus"], [data-qty-increase], button[aria-label*="Increase"]').first();
        if ((await cartPlus.count()) > 0) await cartPlus.click();
        const cart = await page.evaluate(async () => {
          const res = await fetch('/cart.js');
          return res.json();
        });
        expect(cart.item_count).toBeGreaterThanOrEqual(1);
      }
    });

    await step('U07 qty decrease', ['@funnel-qty-decrease', '@cart'], async () => {
      const minus = page.locator(
        'cart-drawer button[name="minus"], .cart-drawer [data-qty-decrease], [data-action="decrease"], button[aria-label*="Decrease"], button:has-text("−"), button:has-text("-")'
      ).first();
      if ((await minus.count()) > 0 && (await minus.isVisible().catch(() => false))) {
        await minus.click();
        await page.waitForTimeout(400);
      } else {
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        const cartMinus = page.locator('button[name="minus"], [data-qty-decrease], button[aria-label*="Decrease"]').first();
        if ((await cartMinus.count()) > 0) await cartMinus.click();
      }
      const cart = await page.evaluate(async () => {
        const res = await fetch('/cart.js');
        return res.json();
      });
      expect(cart.item_count).toBeGreaterThanOrEqual(1);
    });

    await step('U08 remove line', ['@funnel-remove', '@cart'], async () => {
      // Re-add if empty so remove is meaningful
      let cart = await page.evaluate(async () => {
        const res = await fetch('/cart.js');
        return res.json();
      });
      if (!cart.item_count) {
        await gotoPath(page, productPath);
        const atc = page.locator('button[name="add"], [name="add"], button:has-text("Add to cart"), [data-add-to-cart]').first();
        await atc.click();
        await page.waitForTimeout(600);
      }
      const remove = page.locator(
        'cart-drawer [data-remove], cart-drawer a[href*="/cart/change"], .cart-drawer button:has-text("Remove"), cart-remove-button, button[aria-label*="Remove"]'
      ).first();
      if ((await remove.count()) > 0 && (await remove.isVisible().catch(() => false))) {
        await remove.click();
      } else {
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        const cartRemove = page.locator('[data-remove], cart-remove-button, a[href*="/cart/change"], button:has-text("Remove")').first();
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
      const atc = page.locator('button[name="add"], [name="add"], button:has-text("Add to cart"), [data-add-to-cart]').first();
      await atc.click();
      await page.waitForTimeout(600);
      await page.goto('/cart', { waitUntil: 'domcontentloaded' });
      const checkout = page.locator('button[name="checkout"], [name="checkout"], a[href*="/checkout"], button:has-text("Checkout")').first();
      await expect(checkout).toBeVisible({ timeout: 15_000 });
      await Promise.all([
        page.waitForURL(/\/(checkouts?|checkout)\b/i, { timeout: 30_000 }).catch(() => null),
        checkout.click(),
      ]);
      const url = page.url();
      expect(/checkout/i.test(url), `expected checkout URL, got ${url}`).toBeTruthy();
      // Do not complete payment
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    });

    const themeErrors = consoleErrors.filter(Boolean);
    expect(themeErrors, `theme console/network errors: ${themeErrors.join('; ')}`).toEqual([]);
  });
});
