import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { setupCommitlintCommand } from '../../src/commands/setup-commitlint.js';
import { readConfig } from '../../src/lib/config.js';

describe('setup-commitlint command', () => {
  let cwd;
  let origCwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-setup-commitlint-'));
    origCwd = process.cwd();
    process.chdir(cwd);
    return cwd;
  }

  function teardown() {
    if (origCwd) process.chdir(origCwd);
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('writes config.commitlint and scaffolds commitlint when package.json exists', async () => {
    setup();
    const prev = process.env.CLIMAYBE_SKIP_INSTALL;
    process.env.CLIMAYBE_SKIP_INSTALL = '1';
    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'theme', version: '1.0.0' }), 'utf-8');
      await setupCommitlintCommand();
      const config = readConfig(cwd);
      assert.strictEqual(config.commitlint, true);
      assert.ok(existsSync(join(cwd, 'commitlint.config.js')));
      assert.ok(existsSync(join(cwd, '.husky', 'commit-msg')));
    } finally {
      if (prev !== undefined) process.env.CLIMAYBE_SKIP_INSTALL = prev;
      else delete process.env.CLIMAYBE_SKIP_INSTALL;
      teardown();
    }
  });

  it('does not throw when no package.json (writes climaybe.config.json instead)', async () => {
    setup();
    process.env.CLIMAYBE_SKIP_INSTALL = '1';
    try {
      await setupCommitlintCommand();
      assert.ok(existsSync(join(cwd, 'climaybe.config.json')));
      const config = readConfig(cwd);
      assert.strictEqual(config.commitlint, true);
    } finally {
      delete process.env.CLIMAYBE_SKIP_INSTALL;
      teardown();
    }
  });
});
