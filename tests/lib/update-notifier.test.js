import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isVersionGreater } from '../../src/lib/update-notifier.js';

describe('update-notifier', () => {
  describe('isVersionGreater', () => {
    it('returns true when candidate is newer', () => {
      assert.strictEqual(isVersionGreater('2.0.0', '1.9.9'), true);
      assert.strictEqual(isVersionGreater('1.3.0', '1.2.99'), true);
      assert.strictEqual(isVersionGreater('1.2.4', '1.2.3'), true);
    });

    it('returns false when versions are equal or older', () => {
      assert.strictEqual(isVersionGreater('1.2.3', '1.2.3'), false);
      assert.strictEqual(isVersionGreater('1.2.2', '1.2.3'), false);
      assert.strictEqual(isVersionGreater('0.9.9', '1.0.0'), false);
    });

    it('handles optional v prefix and pre-release metadata', () => {
      assert.strictEqual(isVersionGreater('v1.2.4', '1.2.3'), true);
      assert.strictEqual(isVersionGreater('1.2.3-beta.1', '1.2.2'), true);
      assert.strictEqual(isVersionGreater('1.2.3-beta.1', '1.2.3'), false);
    });

    it('returns false for invalid versions', () => {
      assert.strictEqual(isVersionGreater('latest', '1.0.0'), false);
      assert.strictEqual(isVersionGreater('1.0.0', 'not-semver'), false);
    });
  });
});
