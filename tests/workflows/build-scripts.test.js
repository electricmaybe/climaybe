import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildScripts } from '../../src/lib/build-scripts.js';

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

      buildScripts({ cwd: dir });

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

      buildScripts({ cwd: dir });

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

      buildScripts({ cwd: dir });

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

      buildScripts({ cwd: dir });

      const out = readFileSync(join(dir, 'assets', 'index.js'), 'utf-8');
      assert.ok(!/\bimport\b/.test(out), `bundle should not contain import statements\n${out}`);
      assert.match(out, /\bfunction run\(\)/);
      assert.match(out, /console\.log\("flags"\)/);
      assert.match(out, /console\.log\(run\(\)\)/);
    } finally {
      teardown();
    }
  });

  it('strips bare side-effect import lines without semicolon from main.js', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '_scripts'), { recursive: true });
      mkdirSync(join(dir, 'assets'), { recursive: true });

      writeFileSync(
        join(dir, '_scripts', 'main.js'),
        `// Main script file - imports all individual scripts









import "./electric-variant-link-converter.js"
`,
        'utf-8'
      );

      writeFileSync(join(dir, '_scripts', 'electric-variant-link-converter.js'), 'console.log("variant");\n', 'utf-8');

      buildScripts({ cwd: dir });

      const out = readFileSync(join(dir, 'assets', 'index.js'), 'utf-8');
      assert.ok(!/\bimport\b/.test(out), `bundle should not contain import statements\n${out}`);
      assert.match(out, /console\.log\(["']variant["']\)/, out);
    } finally {
      teardown();
    }
  });

  it('builds additional top-level entrypoints to separate asset files', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '_scripts'), { recursive: true });
      mkdirSync(join(dir, 'assets'), { recursive: true });

      writeFileSync(join(dir, '_scripts', 'main.js'), 'console.log("main");\n', 'utf-8');
      writeFileSync(join(dir, '_scripts', 'productpage.js'), 'console.log("product");\n', 'utf-8');

      buildScripts({ cwd: dir });

      assert.ok(existsSync(join(dir, 'assets', 'index.js')));
      assert.ok(existsSync(join(dir, 'assets', 'productpage.js')));
      assert.match(readFileSync(join(dir, 'assets', 'productpage.js'), 'utf-8'), /product/);
    } finally {
      teardown();
    }
  });

  it('does not emit separate bundles for files imported by main.js', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '_scripts'), { recursive: true });
      mkdirSync(join(dir, 'assets'), { recursive: true });

      writeFileSync(join(dir, '_scripts', 'main.js'), 'import "./productpage.js";\nconsole.log("main");\n', 'utf-8');
      writeFileSync(join(dir, '_scripts', 'productpage.js'), 'import "./helpers.js";\nconsole.log("product");\n', 'utf-8');
      writeFileSync(join(dir, '_scripts', 'helpers.js'), 'console.log("helpers");\n', 'utf-8');
      writeFileSync(join(dir, '_scripts', 'other.js'), 'console.log("other");\n', 'utf-8');

      buildScripts({ cwd: dir });

      assert.ok(existsSync(join(dir, 'assets', 'index.js')));
      assert.ok(existsSync(join(dir, 'assets', 'other.js')));
      assert.ok(!existsSync(join(dir, 'assets', 'productpage.js')));
      assert.ok(!existsSync(join(dir, 'assets', 'helpers.js')));
    } finally {
      teardown();
    }
  });

  it('does not emit separate bundles for files imported by another top-level entrypoint', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '_scripts'), { recursive: true });
      mkdirSync(join(dir, 'assets'), { recursive: true });

      writeFileSync(join(dir, '_scripts', 'main.js'), 'console.log("main");\n', 'utf-8');
      writeFileSync(join(dir, '_scripts', 'deferred.js'), 'import "./footer-newsletter.js";\nconsole.log("deferred");\n', 'utf-8');
      writeFileSync(join(dir, '_scripts', 'footer-newsletter.js'), 'console.log("newsletter");\n', 'utf-8');

      buildScripts({ cwd: dir });

      assert.ok(existsSync(join(dir, 'assets', 'index.js')));
      assert.ok(existsSync(join(dir, 'assets', 'deferred.js')));
      assert.ok(!existsSync(join(dir, 'assets', 'footer-newsletter.js')));
      assert.match(readFileSync(join(dir, 'assets', 'deferred.js'), 'utf-8'), /newsletter/);
    } finally {
      teardown();
    }
  });

  it('preserves script comments in production mode', () => {
    const dir = setup();
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      mkdirSync(join(dir, '_scripts'), { recursive: true });
      mkdirSync(join(dir, 'assets'), { recursive: true });

      writeFileSync(
        join(dir, '_scripts', 'main.js'),
        `/** Keep this banner */
// Keep this inline comment
console.log("main");
`,
        'utf-8'
      );

      process.env.NODE_ENV = 'production';
      buildScripts({ cwd: dir });

      const out = readFileSync(join(dir, 'assets', 'index.js'), 'utf-8');
      assert.match(out, /Keep this banner/);
      assert.match(out, /Keep this inline comment/);
      assert.match(out, /console\.log\(["']main["']\)/);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      teardown();
    }
  });

  it('minifies output only when minify option is enabled', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '_scripts'), { recursive: true });
      mkdirSync(join(dir, 'assets'), { recursive: true });

      writeFileSync(
        join(dir, '_scripts', 'main.js'),
        `/** Keep this banner */
// Keep this inline comment
const value = 42;
console.log(value);
`,
        'utf-8'
      );

      buildScripts({ cwd: dir, minify: true });

      const out = readFileSync(join(dir, 'assets', 'index.js'), 'utf-8');
      assert.doesNotMatch(out, /Keep this banner/);
      assert.doesNotMatch(out, /Keep this inline comment/);
      assert.match(out, /const value=42;/);
      assert.match(out, /console\.log\(value\);/);
    } finally {
      teardown();
    }
  });
});
