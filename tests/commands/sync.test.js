import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { syncCommand } from '../../src/commands/sync.js';
import { writeConfig } from '../../src/lib/config.js';

describe('sync command', () => {
  let cwd;
  let origCwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-sync-cmd-'));
    origCwd = process.cwd();
    process.chdir(cwd);
    return cwd;
  }

  function teardown() {
    if (origCwd) process.chdir(origCwd);
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('exits without error in single-store mode', async () => {
    setup();
    try {
      writeConfig({ stores: { main: 'main.myshopify.com' }, default_store: 'main.myshopify.com' }, cwd);
      await syncCommand();
      assert.ok(true);
    } finally {
      teardown();
    }
  });
});
