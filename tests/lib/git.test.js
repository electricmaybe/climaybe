import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isGitRepo,
  currentBranch,
  branchExists,
  createBranch,
  createStoreBranches,
  ensureStagingBranch,
  ensureInitialCommit,
  ensureGitRepo,
} from '../../src/lib/git.js';

function exec(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
}

describe('git', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-git-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  describe('isGitRepo', () => {
    it('returns false in non-git directory', () => {
      const dir = setup();
      try {
        assert.strictEqual(isGitRepo(dir), false);
      } finally {
        teardown();
      }
    });

    it('returns true after git init', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        assert.strictEqual(isGitRepo(dir), true);
      } finally {
        teardown();
      }
    });
  });

  describe('currentBranch', () => {
    it('returns branch name in repo with commit', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        writeFileSync(join(dir, 'f'), 'x', 'utf-8');
        exec('git add f', dir);
        exec('git commit -m "first"', dir);
        const branch = currentBranch(dir);
        assert.ok(branch === 'main' || branch === 'master');
      } finally {
        teardown();
      }
    });
  });

  describe('branchExists', () => {
    it('returns false for non-existent branch', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        writeFileSync(join(dir, 'f'), 'x', 'utf-8');
        exec('git add f', dir);
        exec('git commit -m "first"', dir);
        assert.strictEqual(branchExists('nobranch', dir), false);
      } finally {
        teardown();
      }
    });

    it('returns true after creating branch', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        writeFileSync(join(dir, 'f'), 'x', 'utf-8');
        exec('git add f', dir);
        exec('git commit -m "first"', dir);
        exec('git branch staging', dir);
        assert.strictEqual(branchExists('staging', dir), true);
      } finally {
        teardown();
      }
    });
  });

  describe('createBranch', () => {
    it('creates branch and returns true', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        writeFileSync(join(dir, 'f'), 'x', 'utf-8');
        exec('git add f', dir);
        exec('git commit -m "first"', dir);
        const created = createBranch('staging', dir);
        assert.strictEqual(created, true);
        assert.strictEqual(branchExists('staging', dir), true);
      } finally {
        teardown();
      }
    });

    it('skips and returns false when branch already exists', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        writeFileSync(join(dir, 'f'), 'x', 'utf-8');
        exec('git add f', dir);
        exec('git commit -m "first"', dir);
        createBranch('staging', dir);
        const createdAgain = createBranch('staging', dir);
        assert.strictEqual(createdAgain, false);
      } finally {
        teardown();
      }
    });
  });

  describe('createStoreBranches', () => {
    it('creates staging-<alias> and live-<alias>', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        writeFileSync(join(dir, 'f'), 'x', 'utf-8');
        exec('git add f', dir);
        exec('git commit -m "first"', dir);
        createStoreBranches('myshop', dir);
        assert.strictEqual(branchExists('staging-myshop', dir), true);
        assert.strictEqual(branchExists('live-myshop', dir), true);
      } finally {
        teardown();
      }
    });
  });

  describe('ensureStagingBranch', () => {
    it('creates staging branch', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        writeFileSync(join(dir, 'f'), 'x', 'utf-8');
        exec('git add f', dir);
        exec('git commit -m "first"', dir);
        ensureStagingBranch(dir);
        assert.strictEqual(branchExists('staging', dir), true);
      } finally {
        teardown();
      }
    });
  });

  describe('ensureInitialCommit', () => {
    it('creates initial commit when repo has none', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        ensureInitialCommit(dir);
        exec('git rev-parse HEAD', dir);
        assert.ok(true);
      } finally {
        teardown();
      }
    });

    it('does not error when commit already exists', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        writeFileSync(join(dir, 'f'), 'x', 'utf-8');
        exec('git add f', dir);
        exec('git commit -m "first"', dir);
        ensureInitialCommit(dir);
        assert.ok(true);
      } finally {
        teardown();
      }
    });
  });

  describe('ensureGitRepo', () => {
    it('runs git init when not a repo', () => {
      const dir = setup();
      try {
        ensureGitRepo(dir);
        assert.strictEqual(isGitRepo(dir), true);
      } finally {
        teardown();
      }
    });

    it('does not error when already a repo', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        ensureGitRepo(dir);
        assert.strictEqual(isGitRepo(dir), true);
      } finally {
        teardown();
      }
    });
  });
});
