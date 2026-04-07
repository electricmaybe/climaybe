import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { switchCommand } from '../../src/commands/switch.js';
import { writeConfig, readClimaybeConfig } from '../../src/lib/config.js';

describe('switch command', () => {
  let cwd;
  let origCwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-switch-'));
    origCwd = process.cwd();
    process.chdir(cwd);
    return cwd;
  }

  function teardown() {
    if (origCwd) process.chdir(origCwd);
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('exits without error in single-store mode (no switch)', async () => {
    setup();
    try {
      writeConfig({ stores: { main: 'main.myshopify.com' }, default_store: 'main.myshopify.com' }, cwd);
      await switchCommand('main');
      assert.ok(true);
    } finally {
      teardown();
    }
  });

  it('exits without error for unknown alias in multi-store', async () => {
    setup();
    try {
      writeConfig({
        stores: { a: 'a.myshopify.com', b: 'b.myshopify.com' },
        default_store: 'a.myshopify.com',
      }, cwd);
      await switchCommand('unknown');
      assert.ok(true);
    } finally {
      teardown();
    }
  });

  it('updates default_store and copies store json in multi-store mode', async () => {
    setup();
    try {
      writeConfig(
        {
          stores: { norway: 'norway.myshopify.com', other: 'other.myshopify.com' },
          default_store: 'other.myshopify.com',
        },
        cwd
      );
      const storeDir = join(cwd, 'stores', 'norway', 'config');
      mkdirSync(storeDir, { recursive: true });
      writeFileSync(join(storeDir, 'settings_data.json'), '{"theme":1}', 'utf-8');
      await switchCommand('norway');
      const cfg = readClimaybeConfig(cwd);
      assert.strictEqual(cfg.default_store, 'norway.myshopify.com');
      assert.ok(existsSync(join(cwd, 'config', 'settings_data.json')));
    } finally {
      teardown();
    }
  });
});
