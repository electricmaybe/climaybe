import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getDevKitExistingFiles, scaffoldThemeDevKit } from '../../src/lib/theme-dev-kit.js';
import { readPkg } from '../../src/lib/config.js';

describe('theme-dev-kit', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-dev-kit-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('scaffolds dev kit files and merges package.json defaults', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'theme', version: '1.0.0' }), 'utf-8');
      scaffoldThemeDevKit({ includeVSCodeTasks: true, defaultStoreDomain: 'demo.myshopify.com', cwd: dir });

      assert.ok(existsSync(join(dir, '.theme-check.yml')));
      assert.ok(existsSync(join(dir, '.shopifyignore')));
      assert.ok(existsSync(join(dir, '.vscode', 'tasks.json')));
      const pkg = readPkg(dir);
      assert.strictEqual(pkg.config.store, 'demo.myshopify.com');
      assert.ok(pkg.scripts['tailwind:watch']);
      assert.ok(pkg.devDependencies.nodemon);
      const gitignore = readFileSync(join(dir, '.gitignore'), 'utf-8');
      assert.ok(gitignore.includes('# climaybe: theme dev kit (managed)'));
    } finally {
      teardown();
    }
  });

  it('detects existing files that will be replaced', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'nodemon.json'), '{}\n', 'utf-8');
      mkdirSync(join(dir, '.vscode'), { recursive: true });
      writeFileSync(join(dir, '.vscode', 'tasks.json'), '{}\n', 'utf-8');
      const existing = getDevKitExistingFiles({ includeVSCodeTasks: true, cwd: dir });
      assert.ok(existing.includes('nodemon.json'));
      assert.ok(existing.includes('.vscode/tasks.json'));
    } finally {
      teardown();
    }
  });
});
