import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { writeConfig } from '../../src/lib/config.js';
import { harnessCommand } from '../../src/commands/harness.js';
import { checkCommand } from '../../src/commands/check.js';

describe('harness / check commands', () => {
  let cwd;
  let prevCwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-harness-cmd-'));
    prevCwd = process.cwd();
    process.chdir(cwd);
    return cwd;
  }

  function teardown() {
    process.chdir(prevCwd);
    process.exitCode = 0;
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true, force: true });
  }

  it('refuses app projects with the theme-guard hint', async () => {
    const dir = setup();
    try {
      writeConfig({ project_type: 'app' }, dir);
      const logs = [];
      const orig = console.log;
      console.log = (...args) => logs.push(args.join(' '));
      try {
        await harnessCommand({});
        await checkCommand({});
      } finally {
        console.log = orig;
      }
      assert.ok(logs.some((l) => /project_type: app/i.test(l)));
      assert.ok(logs.some((l) => /theme repos only/i.test(l)));
      assert.ok(!existsSync(join(dir, 'AGENTS.md')));
      assert.strictEqual(process.exitCode, 1);
      process.exitCode = 0;
    } finally {
      teardown();
    }
  });

  it('harness --dry-run does not write files', async () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 't' }), 'utf-8');
      writeConfig(
        {
          project_type: 'theme',
          stores: { a: 'a.myshopify.com' },
          default_store: 'a.myshopify.com',
        },
        dir
      );
      await harnessCommand({ dryRun: true });
      assert.ok(!existsSync(join(dir, 'AGENTS.md')));
    } finally {
      teardown();
    }
  });
});
