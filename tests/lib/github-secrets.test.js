import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getSecretsToPrompt, getSecretsToPromptForNewStore, SECRET_DEFINITIONS } from '../../src/lib/github-secrets.js';

describe('github-secrets prompting behavior', () => {
  it('defines LINEAR_API_KEY as an optional linear-gated secret', () => {
    const linear = SECRET_DEFINITIONS.find((s) => s.name === 'LINEAR_API_KEY');
    assert.ok(linear);
    assert.strictEqual(linear.required, false);
    assert.strictEqual(linear.condition, 'linear');
    assert.match(linear.whereToGet, /linear\.app\/settings\/account\/security/);
  });

  it('includes LINEAR_API_KEY only when linear workflows are enabled', () => {
    const without = getSecretsToPrompt({
      enablePreviewWorkflows: false,
      enableBuildWorkflows: false,
      enableLinearWorkflows: false,
      mode: 'single',
      stores: [{ alias: 'foo', domain: 'foo.myshopify.com' }],
    });
    const withLinear = getSecretsToPrompt({
      enablePreviewWorkflows: false,
      enableBuildWorkflows: false,
      enableLinearWorkflows: true,
      mode: 'single',
      stores: [{ alias: 'foo', domain: 'foo.myshopify.com' }],
    });
    assert.ok(!without.some((s) => s.name === 'LINEAR_API_KEY'));
    assert.ok(withLinear.some((s) => s.name === 'LINEAR_API_KEY'));
  });
  it('marks all single-store init prompts as optional', () => {
    const secrets = getSecretsToPrompt({
      enablePreviewWorkflows: true,
      enableBuildWorkflows: true,
      mode: 'single',
      stores: [{ alias: 'foo', domain: 'foo.myshopify.com' }],
    });

    assert.ok(secrets.length > 0);
    assert.ok(secrets.every((secret) => secret.required === false));
  });

  it('marks all multi-store init prompts as optional', () => {
    const secrets = getSecretsToPrompt({
      enablePreviewWorkflows: true,
      enableBuildWorkflows: true,
      mode: 'multi',
      stores: [
        { alias: 'foo', domain: 'foo.myshopify.com' },
        { alias: 'bar', domain: 'bar.myshopify.com' },
      ],
    });

    assert.ok(secrets.length > 0);
    assert.ok(secrets.every((secret) => secret.required === false));
  });

  it('marks add-store prompts as optional', () => {
    const secrets = getSecretsToPromptForNewStore({ alias: 'foo', domain: 'foo.myshopify.com' });

    assert.ok(secrets.length > 0);
    assert.ok(secrets.every((secret) => secret.required === false));
  });

  it('prompts Dev Dashboard client credentials for preview or build', () => {
    const clientId = SECRET_DEFINITIONS.find((s) => s.name === 'SHOP_CLIENT_ID');
    const clientSecret = SECRET_DEFINITIONS.find((s) => s.name === 'SHOP_CLIENT_SECRET');
    const legacyToken = SECRET_DEFINITIONS.find((s) => s.name === 'SHOP_ACCESS_TOKEN');
    const themeAccess = SECRET_DEFINITIONS.find((s) => s.name === 'SHOPIFY_THEME_ACCESS_TOKEN');
    assert.ok(clientId);
    assert.ok(clientSecret);
    assert.ok(legacyToken);
    assert.ok(themeAccess);
    assert.strictEqual(clientId.condition, 'preview_or_build');
    assert.strictEqual(clientSecret.condition, 'preview_or_build');
    assert.match(clientId.whereToGet, /dev\.shopify\.com|Dev Dashboard|Trafo/i);
    assert.match(legacyToken.whereToGet, /Legacy|Prefer SHOP_CLIENT_ID/i);
    assert.match(themeAccess.whereToGet, /Prefer|Legacy/i);

    const withBuild = getSecretsToPrompt({
      enablePreviewWorkflows: false,
      enableBuildWorkflows: true,
      mode: 'single',
      stores: [{ alias: 'foo', domain: 'foo.myshopify.com' }],
    });
    assert.ok(withBuild.some((s) => s.name === 'SHOP_CLIENT_ID'));
    assert.ok(withBuild.some((s) => s.name === 'SHOP_CLIENT_SECRET'));
    assert.ok(withBuild.some((s) => s.name === 'SHOP_ACCESS_TOKEN'));

    const previewOnly = getSecretsToPrompt({
      enablePreviewWorkflows: true,
      enableBuildWorkflows: false,
      mode: 'single',
      stores: [{ alias: 'foo', domain: 'foo.myshopify.com' }],
    });
    assert.ok(previewOnly.some((s) => s.name === 'SHOP_CLIENT_ID'));
    assert.ok(previewOnly.some((s) => s.name === 'SHOP_CLIENT_SECRET'));
    assert.ok(!previewOnly.some((s) => s.name === 'LHCI_GITHUB_APP_TOKEN'));

    const multi = getSecretsToPrompt({
      enablePreviewWorkflows: true,
      enableBuildWorkflows: true,
      mode: 'multi',
      stores: [
        { alias: 'foo', domain: 'foo.myshopify.com' },
        { alias: 'bar', domain: 'bar.myshopify.com' },
      ],
    });
    // Client credentials are repo-level; theme access may still be per-store legacy.
    assert.ok(multi.some((s) => s.name === 'SHOP_CLIENT_ID'));
    assert.ok(multi.some((s) => s.name === 'SHOP_CLIENT_SECRET'));
    assert.ok(!multi.some((s) => s.name.startsWith('SHOP_ACCESS_TOKEN_')));
    assert.ok(!multi.some((s) => s.name.startsWith('SHOP_CLIENT_ID_')));
    assert.ok(multi.some((s) => s.name === 'SHOPIFY_THEME_ACCESS_TOKEN_FOO'));

    const addStore = getSecretsToPromptForNewStore({ alias: 'baz', domain: 'baz.myshopify.com' });
    assert.ok(addStore.every((s) => s.name.startsWith('SHOPIFY_THEME_ACCESS_TOKEN_')));
  });
});
