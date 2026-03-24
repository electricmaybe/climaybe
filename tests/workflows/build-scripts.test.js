import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';

describe('build-scripts', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-build-scripts-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('inlines imported files and strips ESM import syntax from output bundle', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '_scripts'), { recursive: true });
      mkdirSync(join(dir, 'assets'), { recursive: true });

      writeFileSync(
        join(dir, '_scripts', 'main.js'),
        `import "./utils.js";
import helper from "./helper.js";
console.log("main");
`,
        'utf-8'
      );

      writeFileSync(join(dir, '_scripts', 'utils.js'), 'console.log("utils");\n', 'utf-8');
      writeFileSync(join(dir, '_scripts', 'helper.js'), 'console.log("helper");\n', 'utf-8');

      const sourceScriptPath = join(process.cwd(), 'src', 'workflows', 'build', 'build-scripts.js');
      const tempScriptPath = join(dir, 'build-scripts.js');
      copyFileSync(sourceScriptPath, tempScriptPath);
      const result = spawnSync(process.execPath, [tempScriptPath], { cwd: dir, encoding: 'utf-8' });
      assert.strictEqual(result.status, 0, result.stderr || result.stdout);

      const out = readFileSync(join(dir, 'assets', 'index.js'), 'utf-8');
      assert.match(out, /console\.log\(["']utils["']\)/, out);
      assert.match(out, /console\.log\(["']helper["']\)/, out);
      assert.match(out, /console\.log\(["']main["']\)/, out);
      assert.ok(!/\bimport\b/.test(out), 'bundle should not contain import statements');
    } finally {
      teardown();
    }
  });
});
