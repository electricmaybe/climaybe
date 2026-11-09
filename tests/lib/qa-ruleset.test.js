import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import {
  QA_REQUIRED_CHECKS,
  QA_RULESET_NAME,
  getQaRulesetRefIncludes,
  buildQaRulesetPayload,
  normalizeQaRulesetForCompare,
  qaRulesetMatchesDesired,
  isAdminPermissionError,
  syncQaRuleset,
  logQaRulesetResult,
} from '../../src/lib/qa-ruleset.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function mockClient({ listed = [], byId = new Map(), onCreate, onUpdate } = {}) {
  const created = [];
  const updated = [];
  return {
    created,
    updated,
    listRulesets() {
      return listed;
    },
    getRuleset(id) {
      if (!byId.has(id)) throw new Error(`ruleset ${id} not found`);
      return byId.get(id);
    },
    createRuleset(payload) {
      created.push(payload);
      if (onCreate) return onCreate(payload);
      return { id: 99, ...payload };
    },
    updateRuleset(id, payload) {
      updated.push({ id, payload });
      if (onUpdate) return onUpdate(id, payload);
      return { id, ...payload };
    },
  };
}

describe('qa-ruleset', () => {
  describe('constants and builders', () => {
    it('uses the exact check names emitted by store-qa workflows', () => {
      assert.deepEqual(QA_REQUIRED_CHECKS, ['qa-auto', 'qa-manual']);
      assert.equal(QA_RULESET_NAME, 'climaybe QA gate');

      const autoWf = readFileSync(join(packageRoot, 'src/workflows/qa/store-qa.yml'), 'utf-8');
      const manualWf = readFileSync(join(packageRoot, 'src/workflows/qa/store-qa-manual.yml'), 'utf-8');
      assert.match(autoWf, /^\s+name:\s*qa-auto\s*$/m);
      assert.match(manualWf, /^\s+name:\s*qa-manual\s*$/m);
      assert.match(autoWf, /name:\s*'qa-auto'/);
      assert.match(autoWf, /name:\s*'qa-manual'/);
      assert.match(manualWf, /name:\s*'qa-manual'/);
    });

    it('targets main for single-store and live-* for multi-store', () => {
      assert.deepEqual(getQaRulesetRefIncludes('single'), ['refs/heads/main']);
      assert.deepEqual(getQaRulesetRefIncludes('multi'), ['refs/heads/live-*']);
      assert.deepEqual(getQaRulesetRefIncludes(), ['refs/heads/main']);
    });

    it('builds an active branch ruleset with required status checks only', () => {
      const payload = buildQaRulesetPayload('multi');
      assert.equal(payload.name, QA_RULESET_NAME);
      assert.equal(payload.target, 'branch');
      assert.equal(payload.enforcement, 'active');
      assert.deepEqual(payload.conditions.ref_name.include, ['refs/heads/live-*']);
      assert.deepEqual(payload.conditions.ref_name.exclude, []);
      assert.equal(payload.rules.length, 1);
      assert.equal(payload.rules[0].type, 'required_status_checks');
      assert.equal(payload.rules[0].parameters.strict_required_status_checks_policy, false);
      assert.deepEqual(
        payload.rules[0].parameters.required_status_checks.map((c) => c.context),
        ['qa-auto', 'qa-manual']
      );
    });
  });

  describe('normalize / match', () => {
    it('treats GitHub bookkeeping fields as irrelevant', () => {
      const desired = buildQaRulesetPayload('single');
      const fromApi = {
        id: 42,
        node_id: 'RS_x',
        source: 'Repository',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        _links: { self: { href: '…' } },
        ...desired,
        rules: [
          {
            type: 'required_status_checks',
            parameters: {
              strict_required_status_checks_policy: false,
              do_not_enforce_on_create: false,
              required_status_checks: [
                { context: 'qa-manual', integration_id: null },
                { context: 'qa-auto' },
              ],
            },
          },
        ],
      };
      assert.equal(qaRulesetMatchesDesired(desired, fromApi), true);
      assert.ok(normalizeQaRulesetForCompare(fromApi));
    });

    it('detects ref or check drift', () => {
      const desired = buildQaRulesetPayload('single');
      const wrongRefs = buildQaRulesetPayload('multi');
      assert.equal(qaRulesetMatchesDesired(desired, wrongRefs), false);

      const wrongChecks = structuredClone(desired);
      wrongChecks.rules[0].parameters.required_status_checks = [{ context: 'qa-auto' }];
      assert.equal(qaRulesetMatchesDesired(desired, wrongChecks), false);
    });
  });

  describe('isAdminPermissionError', () => {
    it('recognizes common admin/403 failure text', () => {
      assert.equal(isAdminPermissionError('HTTP 403: Forbidden'), true);
      assert.equal(isAdminPermissionError('Must have admin rights to Repository'), true);
      assert.equal(isAdminPermissionError('Resource not accessible by integration'), true);
      assert.equal(isAdminPermissionError('Not Found'), false);
    });
  });

  describe('syncQaRuleset', () => {
    let cwd;

    beforeEach(() => {
      cwd = mkdtempSync(join(tmpdir(), 'climaybe-qa-ruleset-'));
    });

    afterEach(() => {
      if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
    });

    it('skips when there is no GitHub origin remote', () => {
      const result = syncQaRuleset({ mode: 'single', cwd });
      assert.equal(result.skipped, 'no_github_remote');
      assert.equal(result.action, null);
    });

    it('creates the ruleset when missing (mocked API)', () => {
      const client = mockClient({ listed: [] });
      const result = syncQaRuleset({ mode: 'single', cwd, client });
      assert.equal(result.skipped, null);
      assert.equal(result.action, 'create');
      assert.equal(client.created.length, 1);
      assert.equal(client.created[0].name, QA_RULESET_NAME);
      assert.deepEqual(result.checks, ['qa-auto', 'qa-manual']);
      assert.deepEqual(result.refs, ['refs/heads/main']);
    });

    it('noops when the existing ruleset already matches', () => {
      const desired = buildQaRulesetPayload('multi');
      const existing = { id: 7, ...desired };
      const client = mockClient({
        listed: [{ id: 7, name: QA_RULESET_NAME }],
        byId: new Map([[7, existing]]),
      });
      const result = syncQaRuleset({ mode: 'multi', cwd, client });
      assert.equal(result.action, 'noop');
      assert.equal(client.created.length, 0);
      assert.equal(client.updated.length, 0);
      assert.equal(result.rulesetId, 7);
    });

    it('updates when the ruleset differs', () => {
      const stale = buildQaRulesetPayload('single');
      stale.rules[0].parameters.required_status_checks = [{ context: 'qa-auto' }];
      const client = mockClient({
        listed: [{ id: 3, name: QA_RULESET_NAME }],
        byId: new Map([[3, { id: 3, ...stale }]]),
      });
      const result = syncQaRuleset({ mode: 'single', cwd, client });
      assert.equal(result.action, 'update');
      assert.equal(client.updated.length, 1);
      assert.equal(client.updated[0].id, 3);
      assert.deepEqual(
        client.updated[0].payload.rules[0].parameters.required_status_checks.map((c) => c.context),
        ['qa-auto', 'qa-manual']
      );
    });

    it('dry-run create prints intent without writing', () => {
      const client = mockClient({ listed: [] });
      const result = syncQaRuleset({ mode: 'multi', cwd, client, dryRun: true });
      assert.equal(result.action, 'create');
      assert.equal(result.dryRun, true);
      assert.equal(client.created.length, 0);
      assert.equal(client.updated.length, 0);
      assert.ok(result.desired);
      assert.deepEqual(result.refs, ['refs/heads/live-*']);
    });

    it('dry-run update does not call updateRuleset', () => {
      const stale = buildQaRulesetPayload('single');
      stale.enforcement = 'disabled';
      const client = mockClient({
        listed: [{ id: 11, name: QA_RULESET_NAME }],
        byId: new Map([[11, { id: 11, ...stale }]]),
      });
      const result = syncQaRuleset({ mode: 'single', cwd, client, dryRun: true });
      assert.equal(result.action, 'update');
      assert.equal(result.dryRun, true);
      assert.equal(client.updated.length, 0);
    });

    it('leaves other rulesets alone (only looks up by name)', () => {
      const client = mockClient({
        listed: [
          { id: 1, name: 'Someone else PR gate' },
          { id: 2, name: 'Require linear history' },
        ],
      });
      const result = syncQaRuleset({ mode: 'single', cwd, client });
      assert.equal(result.action, 'create');
      assert.equal(client.created.length, 1);
      assert.equal(client.updated.length, 0);
    });

    it('fails gracefully when the token lacks admin permission', () => {
      const client = {
        listRulesets() {
          const err = new Error('HTTP 403: Must have admin rights to Repository');
          err.body = 'HTTP 403: Must have admin rights to Repository';
          throw err;
        },
        getRuleset() {},
        createRuleset() {},
        updateRuleset() {},
      };
      const result = syncQaRuleset({ mode: 'single', cwd, client });
      assert.equal(result.skipped, 'admin_required');
      assert.match(result.message, /admin permission/i);
    });
  });

  describe('logQaRulesetResult', () => {
    let logs;
    const original = console.log;

    beforeEach(() => {
      logs = [];
      console.log = (msg) => logs.push(String(msg));
    });

    afterEach(() => {
      console.log = original;
    });

    it('reports admin_required clearly', () => {
      logQaRulesetResult({
        skipped: 'admin_required',
        message: 'GitHub token lacks admin permission to manage repository rulesets.',
      });
      assert.match(logs.join('\n'), /admin permission/i);
    });

    it('reports create / noop', () => {
      logQaRulesetResult(
        {
          skipped: null,
          action: 'create',
          dryRun: false,
          refs: ['refs/heads/main'],
          checks: QA_REQUIRED_CHECKS,
        },
        'single'
      );
      assert.match(logs.join('\n'), /created/);
      assert.match(logs.join('\n'), /qa-auto/);

      logs.length = 0;
      logQaRulesetResult(
        {
          skipped: null,
          action: 'noop',
          dryRun: false,
          refs: ['refs/heads/live-*'],
          checks: QA_REQUIRED_CHECKS,
        },
        'multi'
      );
      assert.match(logs.join('\n'), /already up to date/);
    });
  });
});
