import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { readPkg, writePkg } from './config.js';

const COMMITLINT_DEPS = {
  '@commitlint/cli': '^20.4.4',
  '@commitlint/config-conventional': '^20.4.4',
  husky: '^9.1.7',
};

const COMMITLINT_CONFIG = `/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore'],
    ],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 200],
  },
};
`;

const HUSKY_COMMIT_MSG = `npx --no-install commitlint --edit "$1"
`;

const CURSOR_COMMIT_SKILL = `---
name: commit
description: Groups working-tree changes into logical commits and commits them using conventional commit rules (type, optional scope, subject; commitlint). Use when the user asks to commit, group commits, stage and commit, or write conventional commits.
---

# Commit (group + conventional)

Group changes by purpose, then commit each group with a valid conventional message so commitlint and semantic-release stay happy.

## Workflow

1. **Inspect** — Get full picture of changes (git status, git diff).
2. **Group** — Partition by type: feat, fix, docs, style, refactor, perf, test, build, ci, chore.
3. **Commit each group** — type(scope): subject, imperative, lowercase, no period, ≤100 chars.
4. **Validate** — commit-msg hook will reject invalid messages.

## Message rules (commitlint)

- **Types:** feat, fix, docs, style, refactor, perf, test, build, ci, chore.
- **Header:** type(scope): subject — subject max 100 chars. Body lines max 200.
- **Imperative, present tense:** "add feature" not "added feature".

## Examples

feat(init): add store alias prompt
fix(sync): prevent overwrite of unchanged files
docs: add conventional commit section to CONTRIBUTING
`;

/**
 * Scaffold commitlint config, Husky commit-msg hook, and add deps to package.json.
 * Runs npm install so husky prepare runs and hooks are installed (unless options.skipInstall).
 * @param {string} [cwd] - Working directory (default process.cwd())
 * @param {{ skipInstall?: boolean }} [options] - skipInstall: true to skip npm install (e.g. in tests)
 * @returns {boolean} - true if scaffolded, false if skipped/failed
 */
export function scaffoldCommitlint(cwd = process.cwd(), options = {}) {
  const pkg = readPkg(cwd);
  if (!pkg) return false;

  const updated = { ...pkg };
  updated.scripts = { ...pkg.scripts };
  if (!updated.scripts.prepare) {
    updated.scripts.prepare = 'husky';
  } else if (!updated.scripts.prepare.includes('husky')) {
    updated.scripts.prepare = `husky && ${updated.scripts.prepare}`;
  }
  updated.devDependencies = { ...pkg.devDependencies, ...COMMITLINT_DEPS };
  writePkg(updated, cwd);

  writeFileSync(join(cwd, 'commitlint.config.js'), COMMITLINT_CONFIG, 'utf-8');

  const huskyDir = join(cwd, '.husky');
  if (!existsSync(huskyDir)) {
    mkdirSync(huskyDir, { recursive: true });
  }
  writeFileSync(join(huskyDir, 'commit-msg'), HUSKY_COMMIT_MSG, 'utf-8');

  if (options.skipInstall) return true;
  try {
    execSync('npm install', { cwd, stdio: 'inherit' });
  } catch {
    return false;
  }
  return true;
}

/**
 * Scaffold Cursor commit skill into .cursor/skills/commit/SKILL.md.
 * @param {string} [cwd] - Working directory (default process.cwd())
 * @returns {boolean} - true if written
 */
export function scaffoldCursorCommitSkill(cwd = process.cwd()) {
  const skillDir = join(cwd, '.cursor', 'skills', 'commit');
  if (!existsSync(skillDir)) {
    mkdirSync(skillDir, { recursive: true });
  }
  const skillPath = join(skillDir, 'SKILL.md');
  writeFileSync(skillPath, CURSOR_COMMIT_SKILL, 'utf-8');
  return true;
}
