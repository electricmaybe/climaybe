import { test, expect, gotoPath } from '../fixtures/store.js';

test.describe('Forms @forms', () => {
  test('U25 newsletter empty email validation @forms', async ({ page, qaFixtures }) => {
    if (qaFixtures.features?.newsletter === false) {
      test.skip(true, 'newsletter disabled in qa/config.yml');
    }
    await gotoPath(page, '/');
    const email = page
      .locator(
        'form[action*="contact"] input[type="email"], footer input[type="email"], [name="contact[email]"]'
      )
      .first();
    if ((await email.count()) === 0) {
      throw new Error('No newsletter email field found (set features.newsletter: false to skip)');
    }
    await email.fill('');
    const form = email.locator('xpath=ancestor::form');
    const submit = form.locator('button[type="submit"], input[type="submit"]').first();
    if ((await submit.count()) > 0) {
      await submit.click({ force: true }).catch(() => {});
    } else {
      await email.evaluate((el) => /** @type {HTMLInputElement} */ (el).reportValidity());
    }
    const invalid = await email.evaluate((el) => {
      const input = /** @type {HTMLInputElement} */ (el);
      return {
        message: input.validationMessage || '',
        valid: input.checkValidity(),
      };
    });
    const themeError = page.locator('.errors, .form__message, [data-form-error], .newsletter-error');
    const hasThemeError =
      (await themeError.count()) > 0 && (await themeError.first().isVisible().catch(() => false));
    expect(
      Boolean(invalid.message) || invalid.valid === false || hasThemeError,
      'empty newsletter email must show HTML5 validation or a theme error'
    ).toBeTruthy();
  });

  test('U26 contact required-field validation @forms', async ({ page, qaFixtures }) => {
    if (qaFixtures.features?.contact_form === false) {
      test.skip(true, 'contact form disabled in qa/config.yml');
    }
    await gotoPath(page, qaFixtures.contactPath || '/pages/contact');
    const form = page.locator('form[action*="contact"]').first();
    if ((await form.count()) === 0) {
      throw new Error('No contact form found (set features.contact_form: false to skip)');
    }
    const required = form.locator('[required]').first();
    if ((await required.count()) === 0) {
      throw new Error('Contact form has no [required] fields to validate');
    }
    await required.fill('').catch(() => {});
    const submit = form.locator('button[type="submit"], input[type="submit"]').first();
    if ((await submit.count()) > 0) {
      await submit.click({ force: true }).catch(() => {});
    } else {
      await required.evaluate((el) => /** @type {HTMLInputElement} */ (el).reportValidity());
    }
    const state = await required.evaluate((el) => {
      const input = /** @type {HTMLInputElement} */ (el);
      return { message: input.validationMessage || '', valid: input.checkValidity() };
    });
    const themeError = form.locator('.errors, .form__message, [data-form-error]');
    const hasThemeError =
      (await themeError.count()) > 0 && (await themeError.first().isVisible().catch(() => false));
    expect(
      Boolean(state.message) || state.valid === false || hasThemeError,
      'required contact field must show validation when empty'
    ).toBeTruthy();
  });
});
