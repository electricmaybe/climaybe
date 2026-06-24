import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  LIVE_BRANCH_BYPASS_USERS,
  getBranchProtectionTargets,
  buildBranchProtectionPayload,
  syncBranchProtection,
  logBranchProtectionResult,
} from '../../src/lib/branch-protection.js';

describe('branch-protection', () => {
  describe('getBranchProtectionTargets', () => {
    it('protects main and unprotects live branches in single-store mode', () => {
      const targets = getBranchProtectionTargets('single', ['voldt', 'eser']);
      assert.deepStrictEqual(targets.protect, ['main']);
      assert.deepStrictEqual(targets.unprotect, ['live-voldt', 'live-eser']);
    });

    it('protects live branches and unprotects main in multi-store mode', () => {
      const targets = getBranchProtectionTargets('multi', ['voldt', 'eser']);
      assert.deepStrictEqual(targets.protect, ['live-voldt', 'live-eser']);
      assert.deepStrictEqual(targets.unprotect, ['main']);
    });

    it('defaults to single-store protection of main with no aliases', () => {
      const targets = getBranchProtectionTargets();
      assert.deepStrictEqual(targets.protect, ['main']);
      assert.deepStrictEqual(targets.unprotect, []);
    });
  });

  describe('buildBranchProtectionPayload', () => {
    it('requires PRs and allows no bypass users by default', () => {
      const payload = buildBranchProtectionPayload();
      assert.ok(payload.required_pull_request_reviews);
      assert.deepStrictEqual(
        payload.required_pull_request_reviews.bypass_pull_request_allowances.users,
        []
      );
      assert.strictEqual(payload.enforce_admins, true);
      assert.strictEqual(payload.allow_force_pushes, false);
      assert.strictEqual(payload.allow_deletions, false);
    });

    it('grants the live-branch bypass users when allowShopifyBypass is set', () => {
      const payload = buildBranchProtectionPayload({ allowShopifyBypass: true });
      assert.deepStrictEqual(
        payload.required_pull_request_reviews.bypass_pull_request_allowances.users,
        LIVE_BRANCH_BYPASS_USERS
      );
    });
  });

  describe('syncBranchProtection', () => {
    let cwd;

    beforeEach(() => {
      cwd = mkdtempSync(join(tmpdir(), 'climaybe-branch-protection-'));
    });

    afterEach(() => {
      if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
    });

    it('skips when there is no GitHub origin remote', () => {
      const result = syncBranchProtection({ mode: 'single', aliases: [], cwd });
      assert.strictEqual(result.skipped, 'no_github_remote');
      assert.deepStrictEqual(result.applied, []);
      assert.deepStrictEqual(result.removed, []);
      assert.deepStrictEqual(result.pending, []);
      assert.deepStrictEqual(result.failed, []);
    });
  });

  describe('logBranchProtectionResult', () => {
    let logs;
    const original = console.log;

    beforeEach(() => {
      logs = [];
      console.log = (msg) => logs.push(String(msg));
    });

    afterEach(() => {
      console.log = original;
    });

    it('reports a skip reason without listing branches', () => {
      logBranchProtectionResult({ skipped: 'gh_unavailable' }, 'single');
      assert.strictEqual(logs.length, 1);
      assert.match(logs[0], /skipped/i);
      assert.match(logs[0], /gh CLI/i);
    });

    it('reports applied, removed, and pending branches', () => {
      logBranchProtectionResult(
        { skipped: null, applied: ['live-voldt'], removed: ['main'], pending: ['live-eser'], failed: [] },
        'multi'
      );
      const joined = logs.join('\n');
      assert.match(joined, /applied: live-voldt/);
      assert.match(joined, /removed: main/);
      assert.match(joined, /pending.*live-eser/);
    });

    it('reports failures with action and branch', () => {
      logBranchProtectionResult(
        {
          skipped: null,
          applied: [],
          removed: [],
          pending: [],
          failed: [{ branch: 'main', action: 'protect', message: 'boom' }],
        },
        'single'
      );
      assert.match(logs.join('\n'), /protect failed for main: boom/);
    });

    it('reports no changes needed when nothing happened', () => {
      logBranchProtectionResult(
        { skipped: null, applied: [], removed: [], pending: [], failed: [] },
        'single'
      );
      assert.match(logs.join('\n'), /no changes needed \(single-store mode\)/);
    });
  });
});
