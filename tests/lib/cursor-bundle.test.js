import { mkdtempSync, rmSync, existsSync, readFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { scaffoldAiConfig, scaffoldCursorBundle } from '../../src/lib/cursor-bundle.js';

describe('cursor-bundle (AI config)', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-ai-config-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('installs rules, skills, agents, and rules.md into .config/ai (source of truth)', () => {
    const dir = setup();
    try {
      const result = scaffoldAiConfig(dir, { editors: ['cursor'] });
      assert.strictEqual(result.ok, true);

      const indexPath = join(dir, '.config', 'ai', 'rules', '00-rule-index.mdc');
      const skillPath = join(dir, '.config', 'ai', 'skills', 'commit', 'SKILL.md');
      const agentPath = join(dir, '.config', 'ai', 'agents', 'theme-translator.md');
      assert.ok(existsSync(indexPath));
      assert.ok(existsSync(skillPath));
      assert.ok(existsSync(agentPath));
      assert.ok(existsSync(join(dir, '.config', 'ai', 'rules.md')));
      assert.ok(readFileSync(indexPath, 'utf-8').includes('Rule Index'));
      const skill = readFileSync(skillPath, 'utf-8');
      assert.ok(skill.includes('name: commit'));
      assert.ok(skill.includes('conventional'));
      assert.ok(readFileSync(agentPath, 'utf-8').includes('name: theme-translator'));
      assert.ok(existsSync(join(dir, '.config', 'ai', 'rules', 'examples', 'section-example.liquid')));
    } finally {
      teardown();
    }
  });

  it('creates editor bridges that resolve back to the shared source of truth', () => {
    const dir = setup();
    try {
      const result = scaffoldAiConfig(dir, { editors: ['cursor', 'claude', 'copilot'] });
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(
        result.bridges.map((b) => b.link).sort(),
        ['.cursor', '.github/copilot-instructions.md', 'CLAUDE.md'].sort()
      );

      // Dir bridge: .cursor -> .config/ai (rules reachable through it).
      assert.ok(existsSync(join(dir, '.cursor', 'rules', '00-rule-index.mdc')));
      // File bridges resolve to the combined rules entry doc.
      assert.ok(readFileSync(join(dir, 'CLAUDE.md'), 'utf-8').includes('AI ruleset'));
      assert.ok(
        readFileSync(join(dir, '.github', 'copilot-instructions.md'), 'utf-8').includes('AI ruleset')
      );

      // On this platform bridges should be symlinks (zero duplication).
      if (process.platform !== 'win32') {
        assert.ok(lstatSync(join(dir, '.cursor')).isSymbolicLink());
        assert.ok(lstatSync(join(dir, 'CLAUDE.md')).isSymbolicLink());
      }
    } finally {
      teardown();
    }
  });

  it('only creates bridges for the selected editors', () => {
    const dir = setup();
    try {
      scaffoldAiConfig(dir, { editors: ['windsurf'] });
      assert.ok(existsSync(join(dir, '.windsurf', 'rules', '00-rule-index.mdc')));
      assert.ok(!existsSync(join(dir, '.cursor')));
      assert.ok(!existsSync(join(dir, 'CLAUDE.md')));
    } finally {
      teardown();
    }
  });

  it('back-compat wrapper installs the Cursor bridge and returns true', () => {
    const dir = setup();
    try {
      assert.strictEqual(scaffoldCursorBundle(dir), true);
      assert.ok(existsSync(join(dir, '.cursor', 'rules', '00-rule-index.mdc')));
      assert.ok(existsSync(join(dir, '.config', 'ai', 'rules', '00-rule-index.mdc')));
    } finally {
      teardown();
    }
  });
});
