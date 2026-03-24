import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveCliVersion } from '../../src/lib/cli-version.js';

describe('cli-version', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-cli-version-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('prefers package.json version in dev checkout', () => {
    const dir = setup();
    try {
      const binDir = join(dir, 'bin');
      mkdirSync(binDir, { recursive: true });
      mkdirSync(join(dir, '.git'));
      writeFileSync(join(binDir, 'version.txt'), '2.0.0\n', 'utf-8');

      const version = resolveCliVersion({
        packageDir: dir,
        binDir,
        packageVersion: '2.2.3',
      });

      assert.strictEqual(version, '2.2.3');
    } finally {
      teardown();
    }
  });

  it('prefers baked version file in packaged install', () => {
    const dir = setup();
    try {
      const binDir = join(dir, 'bin');
      mkdirSync(binDir, { recursive: true });
      writeFileSync(join(binDir, 'version.txt'), '2.0.0\n', 'utf-8');

      const version = resolveCliVersion({
        packageDir: dir,
        binDir,
        packageVersion: '2.2.3',
      });

      assert.strictEqual(version, '2.0.0');
    } finally {
      teardown();
    }
  });
});
