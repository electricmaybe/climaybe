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

  it('strips common ESM export syntax from output bundle', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '_scripts'), { recursive: true });
      mkdirSync(join(dir, 'assets'), { recursive: true });

      writeFileSync(
        join(dir, '_scripts', 'main.js'),
        `import "./exports.js";
console.log("main");
`,
        'utf-8'
      );

      writeFileSync(
        join(dir, '_scripts', 'exports.js'),
        `export const a = 1;
export function run() { return a; }
export default class Demo {}
export { a };
`,
        'utf-8'
      );

      const sourceScriptPath = join(process.cwd(), 'src', 'workflows', 'build', 'build-scripts.js');
      const tempScriptPath = join(dir, 'build-scripts.js');
      copyFileSync(sourceScriptPath, tempScriptPath);
      const result = spawnSync(process.execPath, [tempScriptPath], { cwd: dir, encoding: 'utf-8' });
      assert.strictEqual(result.status, 0, result.stderr || result.stdout);

      const out = readFileSync(join(dir, 'assets', 'index.js'), 'utf-8');
      assert.ok(!/\bexport\b/.test(out), `bundle should not contain export statements\n${out}`);
      assert.match(out, /\bconst a = 1;/);
      assert.match(out, /\bfunction run\(\)/);
      assert.match(out, /\bclass Demo/);
    } finally {
      teardown();
    }
  });

  it('strips multiline named imports from main.js style headers', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '_scripts'), { recursive: true });
      mkdirSync(join(dir, 'assets'), { recursive: true });

      writeFileSync(
        join(dir, '_scripts', 'main.js'),
        `import {
  debounce,
  delegate,
  triggerEvent,
  fetchConfig
} from "./helpers.js";
import "./core-components.js";
console.log("main");
`,
        'utf-8'
      );

      writeFileSync(join(dir, '_scripts', 'helpers.js'), 'console.log("helpers");\n', 'utf-8');
      writeFileSync(join(dir, '_scripts', 'core-components.js'), 'console.log("core");\n', 'utf-8');

      const sourceScriptPath = join(process.cwd(), 'src', 'workflows', 'build', 'build-scripts.js');
      const tempScriptPath = join(dir, 'build-scripts.js');
      copyFileSync(sourceScriptPath, tempScriptPath);
      const result = spawnSync(process.execPath, [tempScriptPath], { cwd: dir, encoding: 'utf-8' });
      assert.strictEqual(result.status, 0, result.stderr || result.stdout);

      const out = readFileSync(join(dir, 'assets', 'index.js'), 'utf-8');
      assert.ok(!/\bimport\b/.test(out), `bundle should not contain import statements\n${out}`);
      assert.match(out, /console\.log\(["']helpers["']\)/, out);
      assert.match(out, /console\.log\(["']core["']\)/, out);
      assert.match(out, /console\.log\(["']main["']\)/, out);
    } finally {
      teardown();
    }
  });

  it('strips compact imports and import attributes from output bundle', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '_scripts'), { recursive: true });
      mkdirSync(join(dir, 'assets'), { recursive: true });

      writeFileSync(
        join(dir, '_scripts', 'main.js'),
        `import{run}from"./helpers.js";
import "./flags.js" with { type: "js" };
console.log(run());
`,
        'utf-8'
      );

      writeFileSync(
        join(dir, '_scripts', 'helpers.js'),
        `export function run() { return "ok"; }
`,
        'utf-8'
      );
      writeFileSync(join(dir, '_scripts', 'flags.js'), 'console.log("flags");\n', 'utf-8');

      const sourceScriptPath = join(process.cwd(), 'src', 'workflows', 'build', 'build-scripts.js');
      const tempScriptPath = join(dir, 'build-scripts.js');
      copyFileSync(sourceScriptPath, tempScriptPath);
      const result = spawnSync(process.execPath, [tempScriptPath], { cwd: dir, encoding: 'utf-8' });
      assert.strictEqual(result.status, 0, result.stderr || result.stdout);

      const out = readFileSync(join(dir, 'assets', 'index.js'), 'utf-8');
      assert.ok(!/\bimport\b/.test(out), `bundle should not contain import statements\n${out}`);
      assert.match(out, /\bfunction run\(\)/);
      assert.match(out, /console\.log\("flags"\)/);
      assert.match(out, /console\.log\(run\(\)\)/);
    } finally {
      teardown();
    }
  });
});
