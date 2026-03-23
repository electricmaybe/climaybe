import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requireThemeProject } from '../../src/lib/theme-guard.js';
import { writeConfig } from '../../src/lib/config.js';

describe('theme-guard', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-theme-guard-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('returns true for theme project', () => {
    const dir = setup();
    try {
      writeConfig({ stores: { a: 'a.myshopify.com' } }, dir);
      assert.strictEqual(requireThemeProject(dir), true);
    } finally {
      teardown();
    }
  });

  it('returns false for app project', () => {
    const dir = setup();
    try {
      writeConfig({ project_type: 'app' }, dir);
      assert.strictEqual(requireThemeProject(dir), false);
    } finally {
      teardown();
    }
  });
});
