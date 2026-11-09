import { test, expect, gotoPath } from '../fixtures/store.js';

test.describe('Quality listeners @quality', () => {
  test('U28/U29 theme console and asset 404s stay clean on PDP @quality', async ({
    page,
    qaFixtures,
    consoleErrors,
  }) => {
    await gotoPath(page, qaFixtures.productPath);
    await page.waitForTimeout(1000);
    // Broken images
    const broken = await page.evaluate(() =>
      [...document.images]
        .filter((img) => img.naturalWidth === 0 && img.src && !img.src.startsWith('data:'))
        .map((img) => img.src)
        .slice(0, 10)
    );
    expect(broken, `broken images: ${broken.join(', ')}`).toEqual([]);
    expect(consoleErrors, consoleErrors.join('; ')).toEqual([]);
  });
});
