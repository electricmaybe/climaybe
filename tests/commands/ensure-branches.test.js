import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ensureBranchesCommand } from '../../src/commands/ensure-branches.js';
import { branchExists } from '../../src/lib/git.js';

function exec(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
}

function setGitIdentity(cwd) {
  exec('git config user.email "test@test.com"', cwd);
  exec('git config user.name "Test"', cwd);
}

describe('ensure-branches command', () => {
  let cwd;
  let origCwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-ensure-branches-'));
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
      writeFileSync(join(cwd, 'package.json'), '{}', 'utf-8');
      await ensureBranchesCommand();
      assert.ok(true);
    } finally {
      teardown();
    }
  });

  it('exits without error when not a git repo (prints message)', async () => {
    setup();
    try {
      writeFileSync(
        join(cwd, 'package.json'),
        JSON.stringify({
          config: { stores: { foo: 'foo.myshopify.com' } },
        }),
        'utf-8'
      );
      await ensureBranchesCommand();
      assert.ok(true);
    } finally {
      teardown();
    }
  });

  it('creates staging and store branches in single-store mode', async () => {
    setup();
    try {
      writeFileSync(
        join(cwd, 'package.json'),
        JSON.stringify({
          config: { stores: { foo: 'foo.myshopify.com' } },
        }),
        'utf-8'
      );
      exec('git init', cwd);
      setGitIdentity(cwd);
      writeFileSync(join(cwd, 'f'), 'x', 'utf-8');
      exec('git add f', cwd);
      exec('git commit -m "first"', cwd);

      await ensureBranchesCommand();

      assert.strictEqual(branchExists('staging', cwd), true);
      assert.strictEqual(branchExists('staging-foo', cwd), true);
      assert.strictEqual(branchExists('live-foo', cwd), true);
    } finally {
      teardown();
    }
  });

  it('creates staging and per-store branches in multi-store mode', async () => {
    setup();
    try {
      writeFileSync(
        join(cwd, 'package.json'),
        JSON.stringify({
          config: {
            stores: {
              foo: 'foo.myshopify.com',
              bar: 'bar.myshopify.com',
            },
          },
        }),
        'utf-8'
      );
      exec('git init', cwd);
      setGitIdentity(cwd);
      writeFileSync(join(cwd, 'f'), 'x', 'utf-8');
      exec('git add f', cwd);
      exec('git commit -m "first"', cwd);

      await ensureBranchesCommand();

      assert.strictEqual(branchExists('staging', cwd), true);
      assert.strictEqual(branchExists('staging-foo', cwd), true);
      assert.strictEqual(branchExists('live-foo', cwd), true);
      assert.strictEqual(branchExists('staging-bar', cwd), true);
      assert.strictEqual(branchExists('live-bar', cwd), true);
    } finally {
      teardown();
    }
  });

  it('pushes ensured branches to origin when remote exists', async () => {
    setup();
    let remoteDir;
    try {
      writeFileSync(
        join(cwd, 'package.json'),
        JSON.stringify({
          config: { stores: { foo: 'foo.myshopify.com' } },
        }),
        'utf-8'
      );
      exec('git init', cwd);
      setGitIdentity(cwd);
      writeFileSync(join(cwd, 'f'), 'x', 'utf-8');
      exec('git add f', cwd);
      exec('git commit -m "first"', cwd);

      remoteDir = mkdtempSync(join(tmpdir(), 'climaybe-ensure-branches-remote-'));
      exec('git init --bare', remoteDir);
      exec(`git remote add origin "${remoteDir}"`, cwd);

      await ensureBranchesCommand();

      const remoteShowRef = exec(`git --git-dir "${remoteDir}" show-ref`, cwd);
      assert.ok(remoteShowRef.includes('refs/heads/staging'));
      assert.ok(remoteShowRef.includes('refs/heads/staging-foo'));
      assert.ok(remoteShowRef.includes('refs/heads/live-foo'));
    } finally {
      if (remoteDir && existsSync(remoteDir)) rmSync(remoteDir, { recursive: true });
      teardown();
    }
  });
});
