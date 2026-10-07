import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  extractThemeCheckOffenses,
  findNewErrors,
  formatBaseline,
  normalizeThemeCheckErrors,
  offenseKey,
  parseNodeVersion,
  readBaseline,
  runThemeCheckGate,
  runThemeCheckJson,
  THEME_CHECK_BASELINE_PATH,
} from '../../src/lib/theme-check.js';
import { writeConfig } from '../../src/lib/config.js';

function mockRunner(offenses, { missingCli = false, empty = false, invalid = false } = {}) {
  return () => {
    if (missingCli) {
      return {
        status: null,
        stdout: '',
        stderr: 'not found',
        error: Object.assign(new Error('enoent'), { code: 'ENOENT' }),
        missingCli: true,
      };
    }
    if (empty) {
      return { status: 0, stdout: '', stderr: '', missingCli: false };
    }
    if (invalid) {
      return { status: 1, stdout: 'not-json', stderr: '', missingCli: false };
    }
    return {
      status: 1,
      stdout: JSON.stringify({ Offenses: offenses }),
      stderr: '',
      missingCli: false,
    };
  };
}

function runnerResult(partial) {
  return () => ({
    status: 0,
    stdout: '',
    stderr: '',
    missingCli: false,
    ...partial,
  });
}

describe('theme-check gate', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-theme-check-'));
    writeConfig({ project_type: 'theme', stores: { a: 'a.myshopify.com' } }, cwd);
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true, force: true });
  }

  it('parseNodeVersion enforces >= 22.12', () => {
    assert.strictEqual(parseNodeVersion('22.12.0').ok, true);
    assert.strictEqual(parseNodeVersion('22.11.9').ok, false);
    assert.strictEqual(parseNodeVersion('20.19.0').ok, false);
    assert.strictEqual(parseNodeVersion('23.0.0').ok, true);
  });

  it('normalize + formatBaseline is deterministic and sorted', () => {
    const raw = {
      Offenses: [
        { check: 'Z', severity: 'error', message: 'b', path: 'b.liquid', start_row: 2 },
        { check: 'A', severity: 'error', message: 'a', path: 'a.liquid', start_row: 1 },
      ],
    };
    const a = formatBaseline(normalizeThemeCheckErrors(raw));
    const b = formatBaseline(normalizeThemeCheckErrors(raw));
    assert.strictEqual(a, b);
    const parsed = JSON.parse(a);
    assert.strictEqual(parsed.errors[0].check, 'A');
    assert.strictEqual(parsed.errors[1].check, 'Z');
  });

  it('exit 0 when all errors are in the baseline', () => {
    const dir = setup();
    try {
      const offenses = [
        { check: 'MatchingTranslations', severity: 'error', message: 'x', path: 'locales/en.json', start_row: 1 },
      ];
      mkdirSync(join(dir, 'docs', 'harness'), { recursive: true });
      writeFileSync(
        join(dir, THEME_CHECK_BASELINE_PATH),
        formatBaseline(normalizeThemeCheckErrors({ Offenses: offenses })),
        'utf-8'
      );
      const code = runThemeCheckGate({
        cwd: dir,
        nodeVersion: '22.14.0',
        runner: mockRunner(offenses),
      });
      assert.strictEqual(code, 0);
    } finally {
      teardown();
    }
  });

  it('exit 1 on a new error not in the baseline', () => {
    const dir = setup();
    try {
      const baseline = [
        { check: 'Old', severity: 'error', message: 'old', path: 'a.liquid', start_row: 1 },
      ];
      mkdirSync(join(dir, 'docs', 'harness'), { recursive: true });
      writeFileSync(join(dir, THEME_CHECK_BASELINE_PATH), formatBaseline(baseline), 'utf-8');
      const current = [
        ...baseline,
        { check: 'NewCheck', severity: 'error', message: 'new', path: 'b.liquid', start_row: 2 },
      ];
      const code = runThemeCheckGate({
        cwd: dir,
        nodeVersion: '22.14.0',
        runner: mockRunner(current),
      });
      assert.strictEqual(code, 1);
    } finally {
      teardown();
    }
  });

  it('non-zero when Shopify CLI is missing', () => {
    const dir = setup();
    try {
      const code = runThemeCheckGate({
        cwd: dir,
        nodeVersion: '22.14.0',
        runner: mockRunner([], { missingCli: true }),
      });
      assert.strictEqual(code, 1);
    } finally {
      teardown();
    }
  });

  it('non-zero when Node is too old', () => {
    const dir = setup();
    try {
      const code = runThemeCheckGate({
        cwd: dir,
        nodeVersion: '20.19.0',
        runner: mockRunner([]),
      });
      assert.strictEqual(code, 1);
    } finally {
      teardown();
    }
  });

  it('missing baseline treats every error as new and hints --write-baseline', () => {
    const dir = setup();
    try {
      const logs = [];
      const orig = console.log;
      console.log = (...args) => logs.push(args.join(' '));
      try {
        const code = runThemeCheckGate({
          cwd: dir,
          nodeVersion: '22.14.0',
          runner: mockRunner([
            { check: 'X', severity: 'error', message: 'm', path: 'p.liquid', start_row: 1 },
          ]),
        });
        assert.strictEqual(code, 1);
        assert.ok(logs.some((l) => /write-baseline/i.test(l)));
        assert.ok(logs.some((l) => /No baseline/i.test(l)));
      } finally {
        console.log = orig;
      }
    } finally {
      teardown();
    }
  });

  it('empty Theme Check output with exit 0 is handled (0 errors)', () => {
    const dir = setup();
    try {
      const code = runThemeCheckGate({
        cwd: dir,
        nodeVersion: '22.14.0',
        runner: mockRunner([], { empty: true }),
      });
      assert.strictEqual(code, 0);
    } finally {
      teardown();
    }
  });

  it('--write-baseline writes deterministic sorted JSON', () => {
    const dir = setup();
    try {
      const offenses = [
        { check: 'B', severity: 'error', message: 'b', path: 'b.liquid', start_row: 2 },
        { check: 'A', severity: 'error', message: 'a', path: 'a.liquid', start_row: 1 },
      ];
      const code = runThemeCheckGate({
        cwd: dir,
        writeBaseline: true,
        nodeVersion: '22.14.0',
        runner: mockRunner(offenses),
      });
      assert.strictEqual(code, 0);
      const body = readFileSync(join(dir, THEME_CHECK_BASELINE_PATH), 'utf-8');
      const again = formatBaseline(normalizeThemeCheckErrors({ Offenses: offenses }));
      assert.strictEqual(body, again);
      assert.strictEqual(JSON.parse(body).errors[0].check, 'A');
    } finally {
      teardown();
    }
  });

  it('findNewErrors / offenseKey compare stably', () => {
    const a = { check: 'C', severity: 'error', message: 'm', path: 'p', start_row: 1, start_col: 2 };
    const b = { ...a };
    assert.strictEqual(offenseKey(a), offenseKey(b));
    assert.deepStrictEqual(findNewErrors([a, { ...a, check: 'N' }], [a]).map((e) => e.check), ['N']);
  });

  it('readBaseline missing vs present', () => {
    const dir = setup();
    try {
      assert.strictEqual(readBaseline(dir).missing, true);
      mkdirSync(join(dir, 'docs', 'harness'), { recursive: true });
      writeFileSync(join(dir, THEME_CHECK_BASELINE_PATH), formatBaseline([]), 'utf-8');
      assert.strictEqual(readBaseline(dir).missing, false);
    } finally {
      teardown();
    }
  });

  it('--quiet prints a single agent-friendly summary on success', () => {
    const dir = setup();
    try {
      const offenses = [
        { check: 'MatchingTranslations', severity: 'error', message: 'x', path: 'locales/en.json', start_row: 1 },
      ];
      mkdirSync(join(dir, 'docs', 'harness'), { recursive: true });
      writeFileSync(
        join(dir, THEME_CHECK_BASELINE_PATH),
        formatBaseline(normalizeThemeCheckErrors({ Offenses: offenses })),
        'utf-8'
      );
      const logs = [];
      const orig = console.log;
      console.log = (...args) => logs.push(args.join(' '));
      try {
        const code = runThemeCheckGate({
          cwd: dir,
          quiet: true,
          nodeVersion: '22.14.0',
          runner: mockRunner(offenses),
        });
        assert.strictEqual(code, 0);
      } finally {
        console.log = orig;
      }
      assert.deepStrictEqual(logs, ['theme check: 0 new errors (baseline 1)']);
    } finally {
      teardown();
    }
  });

  it('fails closed on nonzero exit with empty output (no fake zero-errors)', () => {
    const parsed = runThemeCheckJson({
      runner: runnerResult({
        status: 1,
        stdout: '',
        stderr: 'Network error: failed to load theme check',
      }),
    });
    assert.strictEqual(parsed.ok, false);
    assert.strictEqual(parsed.executionError, true);
    assert.deepStrictEqual(parsed.errors, []);

    const dir = setup();
    try {
      const code = runThemeCheckGate({
        cwd: dir,
        nodeVersion: '22.14.0',
        runner: runnerResult({
          status: 1,
          stdout: '',
          stderr: 'Network error: failed to load theme check',
        }),
      });
      assert.strictEqual(code, 1);
    } finally {
      teardown();
    }
  });

  it('fails closed on null/signal exit with empty output', () => {
    const parsed = runThemeCheckJson({
      runner: runnerResult({ status: null, stdout: '', stderr: 'killed by signal' }),
    });
    assert.strictEqual(parsed.ok, false);
    assert.strictEqual(parsed.executionError, true);

    const dir = setup();
    try {
      const code = runThemeCheckGate({
        cwd: dir,
        nodeVersion: '22.14.0',
        runner: runnerResult({ status: null, stdout: '', stderr: 'killed by signal' }),
      });
      assert.strictEqual(code, 1);
    } finally {
      teardown();
    }
  });

  it('rejects unrecognized JSON shapes instead of reporting zero errors', () => {
    assert.strictEqual(extractThemeCheckOffenses({ foo: 1 }).recognized, false);
    assert.strictEqual(extractThemeCheckOffenses({ Offenses: [] }).recognized, true);

    const parsed = runThemeCheckJson({
      runner: runnerResult({
        status: 0,
        stdout: JSON.stringify({ unexpected: true, count: 0 }),
        stderr: '',
      }),
    });
    assert.strictEqual(parsed.ok, false);
    assert.strictEqual(parsed.unrecognizedShape, true);
    assert.deepStrictEqual(parsed.errors, []);

    const dir = setup();
    try {
      const code = runThemeCheckGate({
        cwd: dir,
        nodeVersion: '22.14.0',
        runner: runnerResult({
          status: 0,
          stdout: JSON.stringify({ unexpected: true }),
        }),
      });
      assert.strictEqual(code, 1);
    } finally {
      teardown();
    }
  });

  it('does not overwrite an existing baseline when Theme Check execution fails', () => {
    const dir = setup();
    try {
      const prior = [
        { check: 'KeepMe', severity: 'error', message: 'legacy', path: 'a.liquid', start_row: 1 },
      ];
      mkdirSync(join(dir, 'docs', 'harness'), { recursive: true });
      const priorBody = formatBaseline(prior);
      writeFileSync(join(dir, THEME_CHECK_BASELINE_PATH), priorBody, 'utf-8');

      const code = runThemeCheckGate({
        cwd: dir,
        writeBaseline: true,
        nodeVersion: '22.14.0',
        runner: runnerResult({
          status: 1,
          stdout: '',
          stderr: 'Network error: failed to load theme check',
        }),
      });
      assert.strictEqual(code, 1);
      assert.strictEqual(readFileSync(join(dir, THEME_CHECK_BASELINE_PATH), 'utf-8'), priorBody);
    } finally {
      teardown();
    }
  });

  it('still accepts nonzero Theme Check exit with valid known-offense JSON', () => {
    const offenses = [
      { check: 'MatchingTranslations', severity: 'error', message: 'x', path: 'locales/en.json', start_row: 1 },
    ];
    const parsed = runThemeCheckJson({
      runner: runnerResult({
        status: 1,
        stdout: JSON.stringify({ Offenses: offenses }),
        stderr: '',
      }),
    });
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.errors.length, 1);
    assert.strictEqual(parsed.errors[0].check, 'MatchingTranslations');

    const dir = setup();
    try {
      mkdirSync(join(dir, 'docs', 'harness'), { recursive: true });
      writeFileSync(
        join(dir, THEME_CHECK_BASELINE_PATH),
        formatBaseline(normalizeThemeCheckErrors({ Offenses: offenses })),
        'utf-8'
      );
      const code = runThemeCheckGate({
        cwd: dir,
        nodeVersion: '22.14.0',
        runner: mockRunner(offenses),
      });
      assert.strictEqual(code, 0);
    } finally {
      teardown();
    }
  });

  it('malformed JSON fails closed and does not write baseline', () => {
    const dir = setup();
    try {
      const prior = formatBaseline([
        { check: 'KeepMe', severity: 'error', message: 'x', path: 'a.liquid', start_row: 1 },
      ]);
      mkdirSync(join(dir, 'docs', 'harness'), { recursive: true });
      writeFileSync(join(dir, THEME_CHECK_BASELINE_PATH), prior, 'utf-8');

      const code = runThemeCheckGate({
        cwd: dir,
        writeBaseline: true,
        nodeVersion: '22.14.0',
        runner: mockRunner([], { invalid: true }),
      });
      assert.strictEqual(code, 1);
      assert.strictEqual(readFileSync(join(dir, THEME_CHECK_BASELINE_PATH), 'utf-8'), prior);
    } finally {
      teardown();
    }
  });
});
