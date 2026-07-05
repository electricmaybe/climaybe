import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import prompts from 'prompts';
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

  it('writes config (cursor_skills + ai_editors) and installs the ruleset + bridges', async () => {
    setup();
    try {
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'theme', version: '1.0.0' }), 'utf-8');
      prompts.inject([['cursor', 'claude']]); // editor multiselect answer
      await addCursorSkillCommand();
      const config = readConfig(cwd);
      assert.strictEqual(config.cursor_skills, true);
      assert.deepStrictEqual(config.ai_editors, ['cursor', 'claude']);
      const skillPath = join(cwd, '.config', 'ai', 'skills', 'commit', 'SKILL.md');
      assert.ok(existsSync(skillPath));
      assert.ok(readFileSync(skillPath, 'utf-8').includes('name: commit'));
      assert.ok(existsSync(join(cwd, '.config', 'ai', 'rules', '00-rule-index.mdc')));
      assert.ok(existsSync(join(cwd, '.config', 'ai', 'agents', 'theme-translator.md')));
      // Selected bridges exist; unselected ones do not.
      assert.ok(existsSync(join(cwd, '.cursor', 'rules', '00-rule-index.mdc')));
      assert.ok(existsSync(join(cwd, 'CLAUDE.md')));
      assert.ok(!existsSync(join(cwd, '.windsurf')));
    } finally {
      teardown();
    }
  });

  it('does not throw when no package.json (writes climaybe.config.json instead)', async () => {
    setup();
    try {
      prompts.inject([['cursor']]);
      await addCursorSkillCommand();
      assert.ok(existsSync(join(cwd, 'climaybe.config.json')));
      assert.ok(existsSync(join(cwd, '.config', 'ai', 'skills', 'commit', 'SKILL.md')));
      assert.ok(existsSync(join(cwd, '.config', 'ai', 'agents', 'theme-translator.md')));
    } finally {
      teardown();
    }
  });
});
