import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { switchCommand } from '../../src/commands/switch.js';
import { writeConfig } from '../../src/lib/config.js';

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
});
