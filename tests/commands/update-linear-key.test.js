import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import prompts from 'prompts';
import { updateLinearKeyCommand } from '../../src/commands/update-linear-key.js';
import { readConfig } from '../../src/lib/config.js';

describe('update:linear-key command', () => {
  let cwd;
  let origCwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-linear-key-'));
    origCwd = process.cwd();
    process.chdir(cwd);
    writeFileSync(
      join(cwd, 'climaybe.config.json'),
      JSON.stringify({
        project_type: 'theme',
        stores: { demo: 'demo.myshopify.com' },
        preview_workflows: false,
        build_workflows: false,
      }),
      'utf-8'
    );
    return cwd;
  }

  function teardown() {
    if (origCwd) process.chdir(origCwd);
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('enables linear_workflows, writes team, and scaffolds the workflow without storing the key', async () => {
    setup();
    try {
      prompts.inject([true, 'vol', 'lin_api_should_not_be_written']);
      await updateLinearKeyCommand();

      const config = readConfig(cwd);
      assert.strictEqual(config.linear_workflows, true);
      assert.strictEqual(config.linear_team, 'VOL');
      assert.strictEqual(config.linear_statuses.store, 'Staged @staging-<alias>');
      const raw = readFileSync(join(cwd, 'climaybe.config.json'), 'utf-8');
      assert.ok(!raw.includes('lin_api_should_not_be_written'));

      const files = readdirSync(join(cwd, '.github', 'workflows'));
      assert.ok(files.includes('linear-status-sync.yml'));
    } finally {
      teardown();
    }
  });

  it('accepts --team without prompting to change it', async () => {
    setup();
    try {
      prompts.inject(['']);
      await updateLinearKeyCommand({ team: 'ENG' });
      const config = readConfig(cwd);
      assert.strictEqual(config.linear_team, 'ENG');
      assert.strictEqual(config.linear_workflows, true);
    } finally {
      teardown();
    }
  });

  it('refuses to run on app projects', async () => {
    setup();
    try {
      writeFileSync(join(cwd, 'climaybe.config.json'), JSON.stringify({ project_type: 'app' }), 'utf-8');
      await updateLinearKeyCommand({ team: 'VOL' });
      const config = readConfig(cwd);
      assert.strictEqual(config.linear_workflows, undefined);
    } finally {
      teardown();
    }
  });
});
