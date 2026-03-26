import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { updateCommand } from '../../src/commands/update-workflows.js';
import { readPkg } from '../../src/lib/config.js';

describe('update command', () => {
  let cwd;
  let origCwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-update-wf-'));
    origCwd = process.cwd();
    process.chdir(cwd);
    return cwd;
  }

  function teardown() {
    if (origCwd) process.chdir(origCwd);
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('exits without error when no config (prints message)', async () => {
    setup();
    try {
      await updateCommand();
      assert.ok(true);
    } finally {
      teardown();
    }
  });

  it('refreshes theme dev-kit package and gitignore when config exists', async () => {
    setup();
    try {
      writeFileSync(
        join(cwd, 'climaybe.config.json'),
        JSON.stringify({
          project_type: 'theme',
          default_store: 'demo.myshopify.com',
          stores: { demo: 'demo.myshopify.com' },
          preview_workflows: false,
          build_workflows: false,
          vscode_tasks: false,
        }),
        'utf-8'
      );
      writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'theme', version: '1.0.0' }), 'utf-8');

      await updateCommand();

      const pkg = readPkg(cwd);
      assert.ok(pkg.dependencies);
      assert.ok(pkg.dependencies.climaybe);
      assert.ok(pkg.devDependencies);
      assert.ok(pkg.devDependencies.tailwindcss);

      const gitignore = readFileSync(join(cwd, '.gitignore'), 'utf-8');
      assert.ok(gitignore.includes('node_modules/'));
      assert.ok(existsSync(join(cwd, '.github', 'workflows')));
    } finally {
      teardown();
    }
  });
});
