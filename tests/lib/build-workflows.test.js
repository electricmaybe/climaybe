import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getMissingBuildWorkflowRequirements, installBuildScript, removeBuildScript } from '../../src/lib/build-workflows.js';

describe('build-workflows helpers', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-build-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('reports missing required build workflow paths', () => {
    const dir = setup();
    try {
      const missing = getMissingBuildWorkflowRequirements(dir);
      const missingPaths = missing.map((m) => m.path).sort();
      assert.deepStrictEqual(missingPaths, ['_scripts/main.js', '_styles/main.css', 'assets', 'release-notes.md']);
    } finally {
      teardown();
    }
  });

  it('stops reporting files once requirements exist', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '_scripts'), { recursive: true });
      mkdirSync(join(dir, '_styles'), { recursive: true });
      mkdirSync(join(dir, 'assets'), { recursive: true });
      writeFileSync(join(dir, '_scripts', 'main.js'), 'console.log("x");\n');
      writeFileSync(join(dir, '_styles', 'main.css'), '@import "tailwindcss";\n');
      writeFileSync(join(dir, 'release-notes.md'), '# Release\n');

      const missing = getMissingBuildWorkflowRequirements(dir);
      assert.strictEqual(missing.length, 0);
    } finally {
      teardown();
    }
  });

  it('installs and removes bundled build script', () => {
    const dir = setup();
    try {
      installBuildScript(dir);
      assert.ok(existsSync(join(dir, '.climaybe', 'build-scripts.js')));
      assert.ok(existsSync(join(dir, 'build-scripts.js')));
      removeBuildScript(dir);
      assert.ok(!existsSync(join(dir, '.climaybe', 'build-scripts.js')));
      assert.ok(!existsSync(join(dir, 'build-scripts.js')));
    } finally {
      teardown();
    }
  });

  it('does not remove user-managed root build script', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'build-scripts.js'), 'console.log("custom");\n');
      installBuildScript(dir);
      removeBuildScript(dir);
      assert.ok(existsSync(join(dir, 'build-scripts.js')));
    } finally {
      teardown();
    }
  });
});
