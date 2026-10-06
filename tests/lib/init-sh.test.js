import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { writeConfig } from '../../src/lib/config.js';
import { scaffoldHarness } from '../../src/lib/harness.js';

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function nonEmptyLines(text) {
  return text.split(/\r?\n/).filter((l) => l.trim().length > 0);
}

function writeStub(binDir, name, body) {
  const path = join(binDir, name);
  writeFileSync(path, body, 'utf-8');
  chmodSync(path, 0o755);
}

/**
 * Stub `node` so init.sh's Node >= 22.12 gate passes on CI Node 20,
 * while all other node invocations still use the real runtime.
 */
function writeNodeVersionStub(binDir, realNode = process.execPath) {
  writeStub(
    binDir,
    'node',
    `#!/usr/bin/env bash
REAL_NODE="${realNode}"
if [ "$#" -eq 2 ] && [ "$1" = "-p" ] && [ "$2" = "process.versions.node" ]; then
  echo "22.14.0"
  exit 0
fi
exec "$REAL_NODE" "$@"
`
  );
}

function setupTheme({ withLockStamp = true, testScript = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'climaybe-init-sh-'));
  const lock = '{\n  "name": "demo-theme",\n  "lockfileVersion": 3\n}\n';
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'demo-theme',
    version: '1.0.0',
    ...(testScript ? { scripts: { test: 'node --test tests/*.test.js' } } : {}),
  }, null, 2), 'utf-8');
  writeFileSync(join(dir, 'package-lock.json'), lock, 'utf-8');
  writeConfig(
    {
      project_type: 'theme',
      default_store: 'demo.myshopify.com',
      stores: { demo: 'demo.myshopify.com' },
    },
    dir
  );
  scaffoldHarness({ cwd: dir, climaybeVersion: '3.13.0', date: '2026-04-06' });
  mkdirSync(join(dir, 'node_modules'), { recursive: true });
  if (withLockStamp) {
    writeFileSync(join(dir, 'node_modules', '.init-lock-hash'), sha256(lock), 'utf-8');
  }
  mkdirSync(join(dir, 'tests'), { recursive: true });
  writeFileSync(join(dir, 'tests', 'ok.test.js'), "import { it } from 'node:test';\nit('ok', () => {});\n", 'utf-8');

  const bin = join(dir, '.stubs');
  mkdirSync(bin, { recursive: true });
  writeNodeVersionStub(bin);
  return { dir, bin, lock };
}

function runInit(dir, bin, args = [], envExtra = {}) {
  const pathEnv = `${bin}:${process.env.PATH || ''}`;
  return spawnSync('bash', [join(dir, 'init.sh'), ...args], {
    cwd: dir,
    encoding: 'utf-8',
    env: { ...process.env, PATH: pathEnv, ...envExtra },
  });
}

describe('init.sh token-cheap output', () => {
  let dir;

  function teardown() {
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }

  it('green run stays within ~15 non-empty lines and prints summary lines', () => {
    const setup = setupTheme();
    dir = setup.dir;
    try {
      writeStub(
        setup.bin,
        'npm',
        `#!/usr/bin/env bash
echo "npm should not run on up-to-date install" >&2
exit 99
`
      );
      writeStub(
        setup.bin,
        'npx',
        `#!/usr/bin/env bash
# emulate: npx --yes climaybe check --quiet
echo "theme check: 0 new errors (baseline 3674)"
exit 0
`
      );
      // Real npm test would invoke real npm — stub npm for "npm test" too, but install is skipped.
      // Replace npm stub to allow test:
      writeStub(
        setup.bin,
        'npm',
        `#!/usr/bin/env bash
if [ "\$1" = "test" ]; then
  echo "# tests 27"
  echo "# pass 27"
  echo "# fail 0"
  exit 0
fi
echo "unexpected npm \$*" >&2
exit 99
`
      );

      const result = runInit(dir, setup.bin);
      assert.strictEqual(result.status, 0, result.stdout + result.stderr);
      const lines = nonEmptyLines(result.stdout);
      assert.ok(lines.length <= 15, `expected <=15 lines, got ${lines.length}:\n${result.stdout}`);
      assert.ok(lines.length >= 5, `expected >=5 lines, got ${lines.length}`);
      assert.ok(lines.some((l) => l.includes('install: up to date (skipped)')));
      assert.ok(lines.some((l) => /^theme check: 0 new errors \(baseline 3674\)$/.test(l)));
      assert.ok(lines.some((l) => /^tests: 27 passed$/.test(l)));
      assert.ok(lines.some((l) => l.startsWith('ok — next:')));
    } finally {
      teardown();
    }
  });

  it('failing install exits non-zero and prints only the last ~40 log lines + path', () => {
    const setup = setupTheme({ withLockStamp: false });
    dir = setup.dir;
    try {
      writeStub(
        setup.bin,
        'npm',
        `#!/usr/bin/env bash
for i in \$(seq 1 80); do echo "install-noise-\$i"; done
echo "fatal: boom"
exit 1
`
      );
      writeStub(setup.bin, 'npx', '#!/usr/bin/env bash\nexit 0\n');

      const result = runInit(dir, setup.bin);
      assert.notStrictEqual(result.status, 0);
      const out = `${result.stdout}\n${result.stderr}`;
      assert.ok(out.includes('install: FAILED'));
      assert.ok(out.includes('full output:'));
      assert.ok(out.includes('fatal: boom'));
      // Truncation marker when log is long
      assert.ok(out.includes('earlier lines omitted') || out.includes('full output:'));
      const noiseCount = (out.match(/install-noise-/g) || []).length;
      assert.ok(noiseCount <= 45, `expected truncated install noise, saw ${noiseCount}`);
    } finally {
      teardown();
    }
  });

  it('failing theme check exits non-zero with capped head + full output path', () => {
    const setup = setupTheme();
    dir = setup.dir;
    try {
      writeStub(
        setup.bin,
        'npm',
        `#!/usr/bin/env bash
if [ "\$1" = "test" ]; then echo "# pass 1"; exit 0; fi
exit 0
`
      );
      writeStub(
        setup.bin,
        'npx',
        `#!/usr/bin/env bash
echo "theme check: 3 new errors (baseline 10)"
for i in \$(seq 1 80); do echo "    - [Err] file-\$i.liquid — bad"; done
exit 1
`
      );

      const result = runInit(dir, setup.bin);
      assert.notStrictEqual(result.status, 0);
      const out = `${result.stdout}\n${result.stderr}`;
      assert.ok(out.includes('theme check: FAILED'));
      assert.ok(out.includes('full output:'));
      const errLines = (out.match(/file-\d+\.liquid/g) || []).length;
      assert.ok(errLines <= 55, `expected capped check output, saw ${errLines}`);
      assert.ok(out.includes('more, full output:') || out.includes('full output:'));
    } finally {
      teardown();
    }
  });

  it('failing tests exit non-zero with capped output', () => {
    const setup = setupTheme();
    dir = setup.dir;
    try {
      writeStub(
        setup.bin,
        'npm',
        `#!/usr/bin/env bash
if [ "\$1" = "test" ]; then
  for i in \$(seq 1 80); do echo "fail-line-\$i"; done
  echo "not ok 1 - boom"
  exit 1
fi
exit 0
`
      );
      writeStub(
        setup.bin,
        'npx',
        `#!/usr/bin/env bash
echo "theme check: 0 new errors (baseline 1)"
exit 0
`
      );

      const result = runInit(dir, setup.bin);
      assert.notStrictEqual(result.status, 0);
      const out = `${result.stdout}\n${result.stderr}`;
      assert.ok(out.includes('tests: FAILED'));
      assert.ok(out.includes('full output:'));
      const failNoise = (out.match(/fail-line-/g) || []).length;
      assert.ok(failNoise <= 55, `expected capped test output, saw ${failNoise}`);
    } finally {
      teardown();
    }
  });

  it('writes lock stamp after successful install and skips next run', () => {
    const setup = setupTheme({ withLockStamp: false });
    dir = setup.dir;
    try {
      let npmCiCalls = join(dir, 'npm-ci-calls.txt');
      writeStub(
        setup.bin,
        'npm',
        `#!/usr/bin/env bash
if [ "\$1" = "ci" ]; then
  echo call >> "${npmCiCalls}"
  mkdir -p node_modules
  exit 0
fi
if [ "\$1" = "test" ]; then echo "# pass 2"; exit 0; fi
exit 0
`
      );
      writeStub(
        setup.bin,
        'npx',
        `#!/usr/bin/env bash
echo "theme check: 0 new errors (baseline 0)"
exit 0
`
      );

      const first = runInit(dir, setup.bin);
      assert.strictEqual(first.status, 0, first.stdout + first.stderr);
      assert.ok(first.stdout.includes('install: ok'));
      assert.ok(existsSync(join(dir, 'node_modules', '.init-lock-hash')));
      assert.strictEqual(readFileSync(npmCiCalls, 'utf-8').trim().split('\n').length, 1);

      const second = runInit(dir, setup.bin);
      assert.strictEqual(second.status, 0, second.stdout + second.stderr);
      assert.ok(second.stdout.includes('install: up to date (skipped)'));
      assert.strictEqual(readFileSync(npmCiCalls, 'utf-8').trim().split('\n').length, 1);
    } finally {
      teardown();
    }
  });

  it('supports --verbose (does not require summary-only capture path)', () => {
    const setup = setupTheme();
    dir = setup.dir;
    try {
      writeStub(
        setup.bin,
        'npm',
        `#!/usr/bin/env bash
if [ "\$1" = "test" ]; then echo "verbose-test-output"; echo "# pass 1"; exit 0; fi
exit 0
`
      );
      writeStub(
        setup.bin,
        'npx',
        `#!/usr/bin/env bash
echo "verbose-check-banner"
echo "  Theme Check: 0 error(s) all known in baseline (1)."
exit 0
`
      );
      const result = runInit(dir, setup.bin, ['--verbose']);
      assert.strictEqual(result.status, 0, result.stdout + result.stderr);
      assert.ok(result.stdout.includes('verbose-check-banner'));
      assert.ok(result.stdout.includes('verbose-test-output'));
    } finally {
      teardown();
    }
  });

  it('generated init.sh still passes bash -n', () => {
    const setup = setupTheme();
    dir = setup.dir;
    try {
      const syntax = spawnSync('bash', ['-n', join(dir, 'init.sh')], { encoding: 'utf-8' });
      assert.strictEqual(syntax.status, 0, syntax.stderr);
      const src = readFileSync(join(dir, 'init.sh'), 'utf-8');
      assert.ok(src.includes('--verbose'));
      assert.ok(src.includes('init-lock-hash'));
      assert.ok(src.includes('--no-audit'));
      assert.ok(src.includes('--quiet'));
    } finally {
      teardown();
    }
  });
});
