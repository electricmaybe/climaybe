import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_LINEAR_STATUSES,
  extractLinearIssueIds,
  isClimaybeLoopCommit,
  isMultiStoreConfig,
  normalizeLinearTeamKey,
  rankForStatusName,
  resolveLinearStatusBucket,
  resolveLinearStatusName,
  resolveLinearStatuses,
  shouldUpdateLinearState,
} from '../../src/lib/linear-status.js';

describe('linear-status mapping', () => {
  describe('normalizeLinearTeamKey', () => {
    it('uppercases a valid key', () => {
      assert.strictEqual(normalizeLinearTeamKey('vol'), 'VOL');
      assert.strictEqual(normalizeLinearTeamKey('  Eng '), 'ENG');
    });

    it('returns empty string when unset', () => {
      assert.strictEqual(normalizeLinearTeamKey(''), '');
      assert.strictEqual(normalizeLinearTeamKey(undefined), '');
    });

    it('returns null for invalid keys', () => {
      assert.strictEqual(normalizeLinearTeamKey('V'), null);
      assert.strictEqual(normalizeLinearTeamKey('VOLDTNORWAY'), null);
      assert.strictEqual(normalizeLinearTeamKey('V0L'), null);
    });
  });

  describe('resolveLinearStatuses', () => {
    it('uses Electric Maybe / Voldt defaults', () => {
      assert.deepStrictEqual(resolveLinearStatuses({}), DEFAULT_LINEAR_STATUSES);
      assert.strictEqual(DEFAULT_LINEAR_STATUSES.store, 'Staged @staging-<alias>');
    });

    it('overrides individual names from config', () => {
      const statuses = resolveLinearStatuses({
        linear_statuses: { live: 'Shipped', staging: '  On staging  ' },
      });
      assert.strictEqual(statuses.staging, 'On staging');
      assert.strictEqual(statuses.store, DEFAULT_LINEAR_STATUSES.store);
      assert.strictEqual(statuses.live, 'Shipped');
    });
  });

  describe('isMultiStoreConfig', () => {
    it('is false for missing, empty, or a single store', () => {
      assert.strictEqual(isMultiStoreConfig({}), false);
      assert.strictEqual(isMultiStoreConfig({ stores: {} }), false);
      assert.strictEqual(isMultiStoreConfig({ stores: { euro: 'e.myshopify.com' } }), false);
    });

    it('is true when stores has more than one key', () => {
      assert.strictEqual(
        isMultiStoreConfig({ stores: { euro: 'e.myshopify.com', norway: 'n.myshopify.com' } }),
        true
      );
    });
  });

  describe('resolveLinearStatusBucket', () => {
    it('maps exact staging to staging', () => {
      assert.strictEqual(resolveLinearStatusBucket('staging', { multi: false }), 'staging');
      assert.strictEqual(resolveLinearStatusBucket('staging', { multi: true }), 'staging');
    });

    it('maps staging-* to store (literal Staged @staging-<alias> bucket)', () => {
      assert.strictEqual(resolveLinearStatusBucket('staging-euro', { multi: true }), 'store');
      assert.strictEqual(resolveLinearStatusBucket('staging-norway', { multi: false }), 'store');
      assert.strictEqual(resolveLinearStatusBucket('staging-future-store', { multi: true }), 'store');
    });

    it('maps live-* to live', () => {
      assert.strictEqual(resolveLinearStatusBucket('live-euro', { multi: true }), 'live');
      assert.strictEqual(resolveLinearStatusBucket('live-norway', { multi: false }), 'live');
    });

    it('maps main to live in single-store (main is production)', () => {
      assert.strictEqual(resolveLinearStatusBucket('main', { multi: false }), 'live');
    });

    it('maps main to store in multi-store (main is shared, not live)', () => {
      assert.strictEqual(resolveLinearStatusBucket('main', { multi: true }), 'store');
    });

    it('returns null for other branches', () => {
      assert.strictEqual(resolveLinearStatusBucket('feature/vol-77'), null);
      assert.strictEqual(resolveLinearStatusBucket('develop'), null);
      assert.strictEqual(resolveLinearStatusBucket(''), null);
    });
  });

  describe('resolveLinearStatusName', () => {
    const single = { stores: { euro: 'e.myshopify.com' } };
    const multi = { stores: { euro: 'e.myshopify.com', norway: 'n.myshopify.com' } };

    it('uses default names for single-store main → Done', () => {
      assert.strictEqual(resolveLinearStatusName('main', single), 'Done');
      assert.strictEqual(resolveLinearStatusName('staging', single), 'Staged @staging');
    });

    it('uses store status for multi-store main and staging-*', () => {
      assert.strictEqual(resolveLinearStatusName('main', multi), 'Staged @staging-<alias>');
      assert.strictEqual(resolveLinearStatusName('staging-euro', multi), 'Staged @staging-<alias>');
      assert.strictEqual(resolveLinearStatusName('live-euro', multi), 'Done');
    });
  });

  describe('shouldUpdateLinearState', () => {
    const statuses = DEFAULT_LINEAR_STATUSES;

    it('does not update when already in the target state', () => {
      assert.strictEqual(shouldUpdateLinearState('Done', 'Done', statuses), false);
      assert.strictEqual(shouldUpdateLinearState('Staged @staging', 'Staged @staging', statuses), false);
    });

    it('does not move backward from live to store or staging', () => {
      assert.strictEqual(shouldUpdateLinearState('Done', 'Staged @staging', statuses), false);
      assert.strictEqual(shouldUpdateLinearState('Done', 'Staged @staging-<alias>', statuses), false);
    });

    it('does not move backward from store to staging', () => {
      assert.strictEqual(shouldUpdateLinearState('Staged @staging-<alias>', 'Staged @staging', statuses), false);
    });

    it('moves forward staging → store → live', () => {
      assert.strictEqual(shouldUpdateLinearState('Staged @staging', 'Staged @staging-<alias>', statuses), true);
      assert.strictEqual(shouldUpdateLinearState('Staged @staging-<alias>', 'Done', statuses), true);
      assert.strictEqual(shouldUpdateLinearState('Staged @staging', 'Done', statuses), true);
    });

    it('moves from unknown states (e.g. In Progress) to the target', () => {
      assert.strictEqual(shouldUpdateLinearState('In Progress', 'Staged @staging', statuses), true);
      assert.strictEqual(shouldUpdateLinearState('Todo', 'Done', statuses), true);
    });

    it('ranks configured names, not only defaults', () => {
      const custom = { staging: 'QA', store: 'Store staging', live: 'Shipped' };
      assert.strictEqual(rankForStatusName('Shipped', custom), 2);
      assert.strictEqual(shouldUpdateLinearState('Shipped', 'QA', custom), false);
      assert.strictEqual(shouldUpdateLinearState('QA', 'Shipped', custom), true);
    });
  });

  describe('extractLinearIssueIds', () => {
    it('finds IDs in subjects and bodies and deduplicates', () => {
      const text = 'feat: VOL-77 add nav\n\nAlso VOL-77 and ENG-2.\nFixes VOL-80.';
      assert.deepStrictEqual(extractLinearIssueIds(text), ['VOL-77', 'ENG-2', 'VOL-80']);
    });

    it('filters to a team key when provided', () => {
      const text = 'VOL-77 and ENG-2 and UTF-8';
      assert.deepStrictEqual(extractLinearIssueIds(text, { teamKey: 'vol' }), ['VOL-77']);
    });

    it('ignores lowercase lookalikes', () => {
      assert.deepStrictEqual(extractLinearIssueIds('vol-77 and Vol-77'), []);
    });
  });

  describe('isClimaybeLoopCommit', () => {
    it('skips store-sync, hotfix, and chore(release) hops', () => {
      assert.ok(isClimaybeLoopCommit('chore: sync [skip-store-sync]'));
      assert.ok(isClimaybeLoopCommit('chore: json [stores-to-root]'));
      assert.ok(isClimaybeLoopCommit('chore: json [root-to-stores]'));
      assert.ok(isClimaybeLoopCommit('Merge live-euro into main [hotfix-backport]'));
      assert.ok(isClimaybeLoopCommit('chore(release): bump version to 3.2.0'));
    });

    it('does not skip normal feature commits', () => {
      assert.strictEqual(isClimaybeLoopCommit('feat: VOL-77 add filters'), false);
    });
  });
});
