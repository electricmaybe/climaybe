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
      assert.strictEqual(
        pkg.description,
        'Customizable modular development environment for blazing-fast Shopify theme creation'
      );
      assert.strictEqual(pkg.author, 'Electric Maybe <hello@electricmaybe.com>');
      assert.ok(pkg.dependencies);
      assert.ok(pkg.dependencies.climaybe);
      assert.ok(pkg.devDependencies);
      assert.ok(pkg.devDependencies.tailwindcss);
      const cfg = readClimaybeConfig(dir);
      assert.ok(cfg);
      assert.strictEqual(cfg.project_type, 'theme');
      assert.strictEqual(cfg.default_store, 'demo.myshopify.com');
      assert.strictEqual(cfg.vscode_tasks, true);
      const themeCheck = readFileSync(join(dir, '.theme-check.yml'), 'utf-8');
      assert.ok(themeCheck.includes('extends: theme-check:recommended'));
      const shopifyignore = readFileSync(join(dir, '.shopifyignore'), 'utf-8');
      assert.ok(shopifyignore.includes('.cursor'));
      assert.ok(shopifyignore.includes('stores'));
      const gitignore = readFileSync(join(dir, '.gitignore'), 'utf-8');
      assert.ok(gitignore.includes('# climaybe: theme dev kit (managed)'));
      assert.ok(gitignore.includes('node_modules/'));
      assert.ok(gitignore.includes('assets/index.min.js'));
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

  it('updates existing managed gitignore block on rerun', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'theme', version: '1.0.0' }), 'utf-8');
      writeFileSync(
        join(dir, '.gitignore'),
        ['# climaybe: theme dev kit (managed)', '.vscode', 'assets/style.css', 'assets/index.js', 'assets/index.min.js', '.shopify', '.vercel', ''].join('\n'),
        'utf-8'
      );

      scaffoldThemeDevKit({ includeVSCodeTasks: false, defaultStoreDomain: 'demo.myshopify.com', cwd: dir });
      const gitignore = readFileSync(join(dir, '.gitignore'), 'utf-8');
      assert.ok(gitignore.includes('node_modules/'));
      assert.strictEqual((gitignore.match(/# climaybe: theme dev kit \(managed\)/g) || []).length, 1);
    } finally {
      teardown();
    }
  });
});
