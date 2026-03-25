import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { scaffoldCursorBundle } from '../../src/lib/cursor-bundle.js';

describe('cursor-bundle', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-cursor-bundle-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('copies rules, skills, and agents including theme-translator', () => {
    const dir = setup();
    try {
      assert.strictEqual(scaffoldCursorBundle(dir), true);
      const indexPath = join(dir, '.cursor', 'rules', '00-rule-index.mdc');
      const skillPath = join(dir, '.cursor', 'skills', 'commit', 'SKILL.md');
      const agentPath = join(dir, '.cursor', 'agents', 'theme-translator.md');
      assert.ok(existsSync(indexPath));
      assert.ok(existsSync(skillPath));
      assert.ok(existsSync(agentPath));
      assert.ok(readFileSync(indexPath, 'utf-8').includes('Rule Index'));
      const skill = readFileSync(skillPath, 'utf-8');
      assert.ok(skill.includes('name: commit'));
      assert.ok(skill.includes('conventional'));
      assert.ok(readFileSync(agentPath, 'utf-8').includes('name: theme-translator'));
      assert.ok(existsSync(join(dir, '.cursor', 'rules', 'examples', 'section-example.liquid')));
    } finally {
      teardown();
    }
  });
});
