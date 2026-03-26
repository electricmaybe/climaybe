import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getSecretsToPrompt, getSecretsToPromptForNewStore } from '../../src/lib/github-secrets.js';

describe('github-secrets prompting behavior', () => {
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
