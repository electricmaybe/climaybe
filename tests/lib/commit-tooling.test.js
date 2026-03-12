import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { scaffoldCommitlint, scaffoldCursorCommitSkill } from '../../src/lib/commit-tooling.js';

describe('commit-tooling', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-commit-tooling-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  describe('scaffoldCommitlint', () => {
    it('returns false when no package.json', () => {
      const dir = setup();
      try {
        assert.strictEqual(scaffoldCommitlint(dir, { skipInstall: true }), false);
      } finally {
        teardown();
      }
    });

    it('writes commitlint.config.js, .husky/commit-msg, and updates package.json when skipInstall', () => {
      const dir = setup();
      try {
        const pkgPath = join(dir, 'package.json');
        writeFileSync(pkgPath, JSON.stringify({ name: 'test-theme', version: '1.0.0' }), 'utf-8');
        const result = scaffoldCommitlint(dir, { skipInstall: true });
        assert.strictEqual(result, true);
        const configPath = join(dir, 'commitlint.config.js');
        assert.ok(existsSync(configPath));
        const config = readFileSync(configPath, 'utf-8');
        assert.ok(config.includes('@commitlint/config-conventional'));
        assert.ok(config.includes('header-max-length'));
        const huskyMsg = readFileSync(join(dir, '.husky', 'commit-msg'), 'utf-8');
        assert.ok(huskyMsg.includes('commitlint --edit'));
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        assert.strictEqual(pkg.scripts.prepare, 'husky');
        assert.ok(pkg.devDependencies['@commitlint/cli']);
        assert.ok(pkg.devDependencies.husky);
      } finally {
        teardown();
      }
    });
  });

  describe('scaffoldCursorCommitSkill', () => {
    it('writes .cursor/skills/commit/SKILL.md', () => {
      const dir = setup();
      try {
        const result = scaffoldCursorCommitSkill(dir);
        assert.strictEqual(result, true);
        const skillPath = join(dir, '.cursor', 'skills', 'commit', 'SKILL.md');
        assert.ok(existsSync(skillPath));
        const content = readFileSync(skillPath, 'utf-8');
        assert.ok(content.includes('name: commit'));
        assert.ok(content.includes('conventional commit'));
      } finally {
        teardown();
      }
    });
  });
});
