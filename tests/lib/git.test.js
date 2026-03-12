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
  getLatestTagVersion,
  getSuggestedTagForRelease,
} from '../../src/lib/git.js';

function exec(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
}

/** Set local git identity so commits work in CI (no global user.name/user.email). */
function setGitIdentity(cwd) {
  exec('git config user.email "test@test.com"', cwd);
  exec('git config user.name "Test"', cwd);
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
        setGitIdentity(dir);
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
        setGitIdentity(dir);
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
        setGitIdentity(dir);
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
        setGitIdentity(dir);
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
        setGitIdentity(dir);
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
        setGitIdentity(dir);
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
        setGitIdentity(dir);
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
        setGitIdentity(dir);
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
        setGitIdentity(dir);
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
        setGitIdentity(dir);
        ensureGitRepo(dir);
        assert.strictEqual(isGitRepo(dir), true);
      } finally {
        teardown();
      }
    });
  });

  describe('getLatestTagVersion', () => {
    it('returns null in non-git directory', () => {
      const dir = setup();
      try {
        assert.strictEqual(getLatestTagVersion(dir), null);
      } finally {
        teardown();
      }
    });

    it('returns null when repo has no v* tags', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        setGitIdentity(dir);
        writeFileSync(join(dir, 'f'), 'x', 'utf-8');
        exec('git add f', dir);
        exec('git commit -m "first"', dir);
        assert.strictEqual(getLatestTagVersion(dir), null);
      } finally {
        teardown();
      }
    });

    it('returns latest version from v* tags (semver sorted)', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        setGitIdentity(dir);
        writeFileSync(join(dir, 'f'), 'x', 'utf-8');
        exec('git add f', dir);
        exec('git commit -m "first"', dir);
        exec('git tag v1.0.0', dir);
        exec('git tag v2.3.1', dir);
        exec('git tag v1.2.0', dir);
        assert.strictEqual(getLatestTagVersion(dir), '2.3.1');
      } finally {
        teardown();
      }
    });
  });

  describe('getSuggestedTagForRelease', () => {
    it('returns v1.0.0 when no tags', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        setGitIdentity(dir);
        writeFileSync(join(dir, 'f'), 'x', 'utf-8');
        exec('git add f', dir);
        exec('git commit -m "first"', dir);
        assert.strictEqual(getSuggestedTagForRelease(dir), 'v1.0.0');
      } finally {
        teardown();
      }
    });

    it('returns next patch when latest tag exists', () => {
      const dir = setup();
      try {
        exec('git init', dir);
        setGitIdentity(dir);
        writeFileSync(join(dir, 'f'), 'x', 'utf-8');
        exec('git add f', dir);
        exec('git commit -m "first"', dir);
        exec('git tag v2.3.1', dir);
        assert.strictEqual(getSuggestedTagForRelease(dir), 'v2.3.2');
      } finally {
        teardown();
      }
    });
  });
});
