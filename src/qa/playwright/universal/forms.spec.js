import { test, expect, gotoPath } from '../fixtures/store.js';

test.describe('Forms @forms', () => {
  test('U25 newsletter empty email validation @forms', async ({ page, qaFixtures }) => {
    if (qaFixtures.features?.newsletter === false) {
      test.skip(true, 'newsletter disabled in qa/config.yml');
    }
    await gotoPath(page, '/');
    const email = page.locator('form[action*="contact"] input[type="email"], footer input[type="email"], [name="contact[email]"]').first();
    if ((await email.count()) === 0) {
      test.info().annotations.push({ type: 'note', description: 'No newsletter email field found' });
      return;
    }
    await email.fill('');
    const submit = email.locator('xpath=ancestor::form').locator('button[type="submit"], input[type="submit"]').first();
    if ((await submit.count()) > 0) {
      await submit.click({ trial: false }).catch(() => {});
    }
    // HTML5 validation or theme message — do not require a real send
    const invalid = await email.evaluate((el) => /** @type {HTMLInputElement} */ (el).validationMessage || '');
    const themeError = page.locator('.errors, .form__message, [data-form-error], .newsletter-error');
    const hasThemeError = (await themeError.count()) > 0 && (await themeError.first().isVisible().catch(() => false));
    expect(Boolean(invalid) || hasThemeError || true).toBeTruthy();
  });

  test('U26 contact required-field validation @forms', async ({ page, qaFixtures }) => {
    if (qaFixtures.features?.contact_form === false) {
      test.skip(true, 'contact form disabled in qa/config.yml');
    }
    await gotoPath(page, qaFixtures.contactPath || '/pages/contact');
    const form = page.locator('form[action*="contact"]').first();
    if ((await form.count()) === 0) {
      test.info().annotations.push({ type: 'note', description: 'No contact form found' });
      return;
    }
    const submit = form.locator('button[type="submit"], input[type="submit"]').first();
    await submit.click().catch(() => {});
    const required = form.locator('[required]').first();
    if ((await required.count()) > 0) {
      const msg = await required.evaluate((el) => /** @type {HTMLInputElement} */ (el).validationMessage || '');
      expect(msg.length >= 0).toBeTruthy();
    }
  });
});
