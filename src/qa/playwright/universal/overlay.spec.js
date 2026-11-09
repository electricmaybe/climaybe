import { test, expect, gotoPath, assertNotCovered } from '../fixtures/store.js';

test.describe('Overlay / z-index @overlay @zindex @quality', () => {
  test('U22 sticky chrome does not cover ATC @overlay @zindex', async ({ page, qaFixtures }) => {
    await gotoPath(page, qaFixtures.productPath);
    const atcSel =
      'button[name="add"], [name="add"], button:has-text("Add to cart"), button:has-text("Add to bag"), [data-add-to-cart]';
    await page.locator(atcSel).first().scrollIntoViewIfNeeded();
    const result = await assertNotCovered(page, atcSel);
    if (result.skipped) {
      test.info().annotations.push({ type: 'note', description: 'ATC not measurable; skipped' });
      return;
    }
    const top = result.top;
    expect(top, 'elementFromPoint should resolve').toBeTruthy();
    const cls = `${top?.id || ''} ${top?.className || ''} ${top?.tag || ''}`.toLowerCase();
    const coveringChrome =
      cls.includes('cookie') ||
      cls.includes('chat') ||
      cls.includes('trustbadge') ||
      cls.includes('sticky-header');
    // Soft signal: if the top element is clearly unrelated chrome, fail
    if (coveringChrome) {
      expect(coveringChrome, `CTA covered by ${cls}`).toBeFalsy();
    }
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
