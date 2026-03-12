import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { updateWorkflowsCommand } from '../../src/commands/update-workflows.js';

describe('update-workflows command', () => {
  let cwd;
  let origCwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-update-wf-'));
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
      await updateWorkflowsCommand();
      assert.ok(true);
    } finally {
      teardown();
    }
  });
});
