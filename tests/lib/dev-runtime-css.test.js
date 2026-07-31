import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CSS_ENTRYPOINTS, getPresentCssEntrypoints } from '../../src/lib/dev-runtime.js';

describe('dev-runtime CSS entrypoints', () => {
  let dir;

  function setup() {
    dir = mkdtempSync(join(tmpdir(), 'climaybe-css-'));
    return dir;
  }

  function teardown() {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  }

  it('lists both CSS entrypoint mappings', () => {
    assert.deepStrictEqual(CSS_ENTRYPOINTS, [
      { input: '_styles/main.css', output: 'assets/style.css' },
      { input: '_styles/critical.css', output: 'assets/critical.css' },
    ]);
  });

  it('returns only present CSS entrypoints', () => {
    dir = setup();
    try {
      assert.deepStrictEqual(getPresentCssEntrypoints(dir), []);

      mkdirSync(join(dir, '_styles'), { recursive: true });
      writeFileSync(join(dir, '_styles', 'main.css'), '@import "tailwindcss";\n', 'utf-8');
      assert.deepStrictEqual(getPresentCssEntrypoints(dir), [CSS_ENTRYPOINTS[0]]);

      writeFileSync(join(dir, '_styles', 'critical.css'), '@import "tailwindcss";\n', 'utf-8');
      assert.deepStrictEqual(getPresentCssEntrypoints(dir), CSS_ENTRYPOINTS);
    } finally {
      teardown();
    }
  });
});
