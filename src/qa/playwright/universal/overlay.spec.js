import { test, expect, gotoPath, assertNotCovered } from '../fixtures/store.js';

test.describe('Overlay / z-index @overlay @zindex @quality', () => {
  test('U22 sticky chrome does not cover ATC @overlay @zindex', async ({ page, qaFixtures }) => {
    await gotoPath(page, qaFixtures.productPath);
    const atcSel =
      'button[name="add"], [name="add"], button:has-text("Add to cart"), button:has-text("Add to bag"), [data-add-to-cart]';
    const atc = page.locator(atcSel).first();
    await expect(atc, 'ATC must be present for overlay check').toBeVisible({ timeout: 15_000 });
    await atc.scrollIntoViewIfNeeded();
    const result = await assertNotCovered(page, atcSel);
    expect(result.skipped, `ATC not measurable (${result.reason || 'unknown'})`).toBeFalsy();
    const top = result.top;
    expect(top, 'elementFromPoint should resolve').toBeTruthy();
    const cls = `${top?.id || ''} ${top?.className || ''} ${top?.tag || ''}`.toLowerCase();
    const coveringChrome =
      /\bcookie\b/.test(cls) ||
      /\bchat\b/.test(cls) ||
      cls.includes('trustbadge') ||
      cls.includes('sticky-header') ||
      cls.includes('intercom') ||
      cls.includes('crisp');
    expect(coveringChrome, `CTA covered by overlay/chrome: ${cls}`).toBeFalsy();
  });

  test('U23 no horizontal overflow @overflow @zindex', async ({ page, qaFixtures }) => {
    await gotoPath(page, qaFixtures.productPath);
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
      };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});
