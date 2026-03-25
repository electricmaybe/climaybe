import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { addCursorSkillCommand } from '../../src/commands/add-cursor-skill.js';
import { readConfig } from '../../src/lib/config.js';

describe('add-cursor-skill command', () => {
  let cwd;
  let origCwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-add-cursor-skill-'));
    origCwd = process.cwd();
    process.chdir(cwd);
    return cwd;
  }

  function teardown() {
    if (origCwd) process.chdir(origCwd);
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('writes config.cursor_skills, rules, skills, and agents (theme-translator)', async () => {
    setup();
    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'theme', version: '1.0.0' }), 'utf-8');
      await addCursorSkillCommand();
      const config = readConfig(cwd);
      assert.strictEqual(config.cursor_skills, true);
      const skillPath = join(cwd, '.cursor', 'skills', 'commit', 'SKILL.md');
      assert.ok(existsSync(skillPath));
      const content = readFileSync(skillPath, 'utf-8');
      assert.ok(content.includes('name: commit'));
      assert.ok(existsSync(join(cwd, '.cursor', 'rules', '00-rule-index.mdc')));
      assert.ok(existsSync(join(cwd, '.cursor', 'agents', 'theme-translator.md')));
    } finally {
      teardown();
    }
  });

  it('does not throw when no package.json (writeConfig creates it)', async () => {
    setup();
    try {
      await addCursorSkillCommand();
      assert.ok(existsSync(join(cwd, 'package.json')));
      assert.ok(existsSync(join(cwd, '.cursor', 'skills', 'commit', 'SKILL.md')));
      assert.ok(existsSync(join(cwd, '.cursor', 'agents', 'theme-translator.md')));
    } finally {
      teardown();
    }
  });
});
