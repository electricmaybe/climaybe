import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseWorkflowJobs,
  getCustomJobs,
  mergeCustomJobs,
} from '../../src/lib/workflow-custom-jobs.js';
import { scaffoldWorkflows } from '../../src/lib/workflows.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(
  join(__dirname, '..', '..', 'src', 'workflows', 'build', 'build-pipeline.yml'),
  'utf-8'
);

const UNIT_TESTS_JOB = `  # repo-specific: theme unit tests
  unit-tests:
    runs-on: ubuntu-latest
    if: >
      !contains(github.event.head_commit.message, '[hotfix-backport]')
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      # install
      - run: npm ci
      - name: Run unit tests
        run: npm test`;

const EXISTING = `${TEMPLATE.trimEnd()}\n\n${UNIT_TESTS_JOB}\n`;

describe('workflow custom jobs', () => {
  it('parses job ids and attaches leading comments to the job', () => {
    const parsed = parseWorkflowJobs(EXISTING);
    assert.deepStrictEqual(parsed.jobs.map((j) => j.id), ['build', 'unit-tests']);
    const unit = parsed.jobs[1];
    assert.strictEqual(unit.text, UNIT_TESTS_JOB);
    assert.doesNotMatch(parsed.jobs[0].text, /repo-specific/);
  });

  it('returns null when there is no jobs block', () => {
    assert.strictEqual(parseWorkflowJobs('name: x\non: push\n'), null);
  });

  it('treats only non-template job ids as custom', () => {
    const custom = getCustomJobs(EXISTING, TEMPLATE);
    assert.deepStrictEqual(custom.map((j) => j.id), ['unit-tests']);
  });

  it('does not keep a stale copy of a generator-owned job', () => {
    const stale = EXISTING.replace('uses: ./.github/workflows/reusable-build.yml', 'uses: ./old.yml');
    const { content } = mergeCustomJobs(stale, TEMPLATE);
    assert.doesNotMatch(content, /old\.yml/);
    assert.match(content, /reusable-build\.yml/);
  });

  it('appends custom jobs verbatim and is idempotent', () => {
    const first = mergeCustomJobs(EXISTING, TEMPLATE);
    assert.deepStrictEqual(first.preserved, ['unit-tests']);
    assert.strictEqual(first.content, EXISTING);
    const second = mergeCustomJobs(first.content, TEMPLATE);
    assert.strictEqual(second.content, EXISTING);
  });

  it('inserts custom jobs before a top-level key that follows jobs', () => {
    const gen = 'name: x\njobs:\n  a:\n    runs-on: x\n\nenv:\n  A: 1\n';
    const old = 'name: x\njobs:\n  a:\n    runs-on: y\n  b:\n    runs-on: z\n';
    const { content } = mergeCustomJobs(old, gen);
    assert.strictEqual(
      content,
      'name: x\njobs:\n  a:\n    runs-on: x\n\n  b:\n    runs-on: z\n\nenv:\n  A: 1\n'
    );
  });

  it('returns generated content unchanged when there are no custom jobs', () => {
    const { content, preserved } = mergeCustomJobs(TEMPLATE, TEMPLATE);
    assert.strictEqual(content, TEMPLATE);
    assert.deepStrictEqual(preserved, []);
  });

  it('scaffoldWorkflows keeps a custom unit-tests job in build-pipeline.yml', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'climaybe-custom-jobs-'));
    try {
      const wf = join(cwd, '.github', 'workflows');
      mkdirSync(wf, { recursive: true });
      const outdated = EXISTING.replace("'[hotfix-backport]')\n      &&", "'[x]')\n      &&");
      writeFileSync(join(wf, 'build-pipeline.yml'), outdated);
      scaffoldWorkflows('single', { includeBuild: true }, cwd);
      const out = readFileSync(join(wf, 'build-pipeline.yml'), 'utf-8');
      assert.strictEqual(out, EXISTING);
      assert.match(out, /unit-tests:/);
      assert.match(out, /run: npm test/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
