import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getDevKitExistingFiles, scaffoldThemeDevKit } from '../../src/lib/theme-dev-kit.js';
import { readPkg, readClimaybeConfig } from '../../src/lib/config.js';

describe('theme-dev-kit', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-dev-kit-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('scaffolds dev kit files, writes climaybe.config.json, and adds climaybe + tailwindcss deps', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'theme', version: '1.0.0' }), 'utf-8');
      scaffoldThemeDevKit({ includeVSCodeTasks: true, defaultStoreDomain: 'demo.myshopify.com', cwd: dir });

      assert.ok(existsSync(join(dir, '.theme-check.yml')));
      assert.ok(existsSync(join(dir, '.shopifyignore')));
      assert.ok(existsSync(join(dir, '.vscode', 'tasks.json')));
      const pkg = readPkg(dir);
      assert.strictEqual(pkg.config, undefined);
      assert.strictEqual(pkg.scripts, undefined);
      assert.ok(pkg.devDependencies);
      assert.ok(pkg.devDependencies.climaybe);
      assert.ok(pkg.devDependencies.tailwindcss);
      const cfg = readClimaybeConfig(dir);
      assert.ok(cfg);
      assert.strictEqual(cfg.project_type, 'theme');
      assert.strictEqual(cfg.default_store, 'demo.myshopify.com');
      assert.strictEqual(cfg.vscode_tasks, true);
      const gitignore = readFileSync(join(dir, '.gitignore'), 'utf-8');
      assert.ok(gitignore.includes('# climaybe: theme dev kit (managed)'));
    } finally {
      teardown();
    }
  });

  it('detects existing files that will be replaced', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '.vscode'), { recursive: true });
      writeFileSync(join(dir, '.vscode', 'tasks.json'), '{}\n', 'utf-8');
      const existing = getDevKitExistingFiles({ includeVSCodeTasks: true, cwd: dir });
      assert.ok(existing.includes('.vscode/tasks.json'));
    } finally {
      teardown();
    }
  });
});
