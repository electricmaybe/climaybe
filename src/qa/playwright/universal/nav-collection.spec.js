import { test, expect, gotoPath } from '../fixtures/store.js';

test.describe('Navigation / collection @nav @collection @header', () => {
  test('U15 header logo/menu links respond @nav @header', async ({ page }) => {
    await gotoPath(page, '/');
    const logo = page.locator('a[href="/"], header a[href="/"], .header__heading-link').first();
    await expect(logo).toBeVisible({ timeout: 15_000 });
    const menuLink = page.locator('header nav a[href], .header__inline-menu a[href], #menu-drawer a[href]').first();
    if ((await menuLink.count()) > 0) {
      const href = await menuLink.getAttribute('href');
      expect(href).toBeTruthy();
    }
  });

  test('U18 collection page renders cards @collection @nav', async ({ page, qaFixtures }) => {
    await gotoPath(page, qaFixtures.collectionPath || '/collections/all');
    const card = page.locator(
      '.product-card a, .card-wrapper a, product-card a, .grid__item a[href*="/products/"]'
    ).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
  });
});
