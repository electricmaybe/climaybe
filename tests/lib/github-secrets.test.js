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
});
