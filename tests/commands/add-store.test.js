import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import prompts from 'prompts';
import { addStoreCommand } from '../../src/commands/add-store.js';
import { branchExists } from '../../src/lib/git.js';

function exec(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
}

function setGitIdentity(cwd) {
  exec('git config user.email "test@test.com"', cwd);
  exec('git config user.name "Test"', cwd);
}

describe('add-store command', () => {
  let cwd;
  let origCwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-add-store-'));
    origCwd = process.cwd();
    process.chdir(cwd);
    return cwd;
  }

  function teardown() {
    if (origCwd) process.chdir(origCwd);
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('exits without error when no config (prints message)', async () => {
    setup();
    try {
      await addStoreCommand();
      assert.ok(true);
    } finally {
      teardown();
    }
  });

  it('migrates single-store to multi-store and creates branches/dirs for both stores', async () => {
    setup();
    try {
      writeFileSync(
        join(cwd, 'climaybe.config.json'),
        JSON.stringify(
          {
            project_type: 'theme',
            stores: { main: 'main.myshopify.com' },
            default_store: 'main.myshopify.com',
            preview_workflows: false,
            build_workflows: false,
          },
          null,
          2
        ),
        'utf-8'
      );

      exec('git init', cwd);
      setGitIdentity(cwd);
      writeFileSync(join(cwd, 'README.md'), '# test\n', 'utf-8');
      exec('git add README.md climaybe.config.json', cwd);
      exec('git commit -m "first"', cwd);
      exec('git branch staging', cwd);

      prompts.inject(['second', 'second']);
      await addStoreCommand();

      assert.strictEqual(branchExists('staging-main', cwd), true);
      assert.strictEqual(branchExists('live-main', cwd), true);
      assert.strictEqual(branchExists('staging-second', cwd), true);
      assert.strictEqual(branchExists('live-second', cwd), true);

      assert.strictEqual(existsSync(join(cwd, 'stores', 'main', 'config')), true);
      assert.strictEqual(existsSync(join(cwd, 'stores', 'main', 'templates')), true);
      assert.strictEqual(existsSync(join(cwd, 'stores', 'main', 'sections')), true);
      assert.strictEqual(existsSync(join(cwd, 'stores', 'second', 'config')), true);
      assert.strictEqual(existsSync(join(cwd, 'stores', 'second', 'templates')), true);
      assert.strictEqual(existsSync(join(cwd, 'stores', 'second', 'sections')), true);
    } finally {
      prompts.inject([]);
      teardown();
    }
  });
});
