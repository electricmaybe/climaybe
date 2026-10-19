// Runs the generated "Merge into main and push" step of
// multistore-hotfix-to-main.yml against throwaway git repos, so the
// version-conflict auto-resolution is exercised end to end (not just grepped).
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { scaffoldWorkflows } from '../../src/lib/workflows.js';

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function write(root, files) {
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

const pkg = (version, extra = '') => `{\n  "name": "theme",\n  "version": "${version}",\n  "private": true${extra}\n}\n`;
const schema = (version, extra = '') =>
  `[\n  {\n    "name": "theme_info",\n    "theme_name": "Theme",\n    "theme_version": "${version}",\n    "theme_author": "EM"${extra}\n  }\n]\n`;

/** Extract the bash body of the "Merge into main and push" step. */
function extractMergeStep(workflow, source, isDefault) {
  const lines = workflow.split('\n');
  const start = lines.findIndex((l) => l.includes('- name: Merge into main and push'));
  assert.ok(start >= 0, 'merge step not found');
  const runIdx = lines.findIndex((l, i) => i > start && /^\s+run: \|\s*$/.test(l));
  const body = [];
  for (let i = runIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() !== '' && !l.startsWith('          ')) break;
    body.push(l.slice(10));
  }
  return body
    .join('\n')
    .replaceAll('${{ steps.ref.outputs.branch }}', source)
    .replaceAll('${{ steps.check.outputs.is_default_store }}', isDefault ? 'true' : 'false');
}

describe('multistore-hotfix-to-main merge step', () => {
  let workflow;
  let tmp;

  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'climaybe-hotfix-'));
    const scaffold = join(tmp, 'scaffold');
    mkdirSync(scaffold);
    scaffoldWorkflows('multi', {}, scaffold);
    workflow = readFileSync(join(scaffold, '.github', 'workflows', 'multistore-hotfix-to-main.yml'), 'utf-8');
  });

  after(() => rmSync(tmp, { recursive: true, force: true }));

  let n = 0;
  /**
   * Build origin with main + source branch diverged from a common base,
   * run the step in a fresh clone, return { status, output, origin }.
   */
  function scenario({ source, isDefault, base, mainChanges, sourceChanges }) {
    const root = join(tmp, `case-${n++}`);
    const seed = join(root, 'seed');
    const origin = join(root, 'origin.git');
    const work = join(root, 'work');
    mkdirSync(seed, { recursive: true });
    git(root, 'init', '-q', '--bare', '-b', 'main', origin);
    git(seed, 'init', '-q', '-b', 'main');
    write(seed, base);
    git(seed, 'add', '-A');
    git(seed, 'commit', '-q', '-m', 'base');
    git(seed, 'checkout', '-q', '-b', source);
    write(seed, sourceChanges);
    git(seed, 'add', '-A');
    git(seed, 'commit', '-q', '-m', 'fix: hotfix on store branch');
    git(seed, 'checkout', '-q', 'main');
    write(seed, mainChanges);
    git(seed, 'add', '-A');
    git(seed, 'commit', '-q', '-m', 'chore(release): bump');
    git(seed, 'remote', 'add', 'origin', origin);
    git(seed, 'push', '-q', 'origin', 'main', source);
    git(root, 'clone', '-q', origin, work);

    const script = extractMergeStep(workflow, source, isDefault);
    const r = spawnSync('bash', ['-e', '-c', script], { cwd: work, env: GIT_ENV, encoding: 'utf-8' });
    return { status: r.status, output: `${r.stdout}\n${r.stderr}`, origin, mainSha: () => git(origin, 'rev-parse', 'main') };
  }

  const show = (origin, path) => git(origin, 'show', `main:${path}`);

  const base = {
    'package.json': pkg('2.45.0'),
    'config/settings_schema.json': schema('2.45.0'),
    'templates/index.json': '{ "sections": { "a": 1 } }\n',
    'snippets/card.liquid': 'card v1\n',
  };

  it('default store: resolves version-only conflicts to main and keeps the hotfix', () => {
    const r = scenario({
      source: 'live-euro',
      isDefault: true,
      base,
      mainChanges: { 'package.json': pkg('2.46.0'), 'config/settings_schema.json': schema('2.46.0') },
      sourceChanges: {
        'package.json': pkg('2.45.1'),
        'config/settings_schema.json': schema('2.45.1'),
        'snippets/card.liquid': 'card v2 (hotfix)\n',
      },
    });
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /Resolved version-only conflict in package\.json/);
    assert.match(r.output, /Resolved version-only conflict in config\/settings_schema\.json/);
    assert.match(show(r.origin, 'package.json'), /"version": "2\.46\.0"/);
    assert.match(show(r.origin, 'config/settings_schema.json'), /"theme_version": "2\.46\.0"/);
    assert.equal(show(r.origin, 'snippets/card.liquid'), 'card v2 (hotfix)');
    assert.match(git(r.origin, 'log', '-1', '--format=%s', 'main'), /Merge live-euro into main \[hotfix-backport\]/);
    assert.equal(git(r.origin, 'rev-list', '--parents', '-n', '1', 'main').split(' ').length, 3, 'expected a merge commit');
  });

  it('default store: keeps non-conflicting source edits in a version-conflicted file', () => {
    const r = scenario({
      source: 'staging-euro',
      isDefault: true,
      base: { ...base, 'package.json': pkg('2.45.0', ',\n  "a": 1,\n  "b": 2,\n  "c": 3,\n  "d": 4') },
      mainChanges: { 'package.json': pkg('2.46.0', ',\n  "a": 1,\n  "b": 2,\n  "c": 3,\n  "d": 4') },
      sourceChanges: { 'package.json': pkg('2.45.1', ',\n  "a": 1,\n  "b": 2,\n  "c": 3,\n  "d": 40') },
    });
    assert.equal(r.status, 0, r.output);
    const merged = show(r.origin, 'package.json');
    assert.match(merged, /"version": "2\.46\.0"/);
    assert.match(merged, /"d": 40/);
  });

  it('default store: fails on a non-version conflict in package.json and leaves main untouched', () => {
    const r = scenario({
      source: 'live-euro',
      isDefault: true,
      base,
      mainChanges: { 'package.json': pkg('2.45.0', ',\n  "x": "main"') },
      sourceChanges: { 'package.json': pkg('2.45.0', ',\n  "x": "live"') },
    });
    assert.notEqual(r.status, 0);
    assert.match(r.output, /Non-version conflict in package\.json/);
    assert.match(git(r.origin, 'log', '-1', '--format=%s', 'main'), /chore\(release\): bump/);
  });

  it('default store: fails on a conflict outside the version files', () => {
    const r = scenario({
      source: 'live-euro',
      isDefault: true,
      base,
      mainChanges: { 'snippets/card.liquid': 'card main\n' },
      sourceChanges: { 'snippets/card.liquid': 'card live\n' },
    });
    assert.notEqual(r.status, 0);
    assert.match(r.output, /Unexpected merge conflict in snippets\/card\.liquid/);
    assert.match(git(r.origin, 'log', '-1', '--format=%s', 'main'), /chore\(release\): bump/);
  });

  it('default store: takes no shortcut for templates/ conflicts', () => {
    const r = scenario({
      source: 'live-euro',
      isDefault: true,
      base,
      mainChanges: { 'templates/index.json': '{ "sections": { "a": 2 } }\n' },
      sourceChanges: { 'templates/index.json': '{ "sections": { "a": 3 } }\n' },
    });
    assert.notEqual(r.status, 0);
    assert.match(r.output, /Unexpected merge conflict in templates\/index\.json/);
  });

  it('non-default store: keeps main for config/templates/sections conflicts and backports stores/<alias>/', () => {
    const r = scenario({
      source: 'live-norway',
      isDefault: false,
      base: { ...base, 'stores/norway/templates/index.json': '{ "no": 1 }\n' },
      mainChanges: {
        'package.json': pkg('2.46.0'),
        'config/settings_schema.json': schema('2.46.0'),
        'templates/index.json': '{ "sections": { "a": 2 } }\n',
      },
      sourceChanges: {
        'package.json': pkg('2.45.1'),
        'config/settings_schema.json': schema('2.45.1'),
        'templates/index.json': '{ "sections": { "a": "norway" } }\n',
        'stores/norway/templates/index.json': '{ "no": 2 }\n',
      },
    });
    assert.equal(r.status, 0, r.output);
    assert.match(r.output, /Non-default store: kept main's templates\/index\.json/);
    assert.match(r.output, /Non-default store: kept main's config\/settings_schema\.json/);
    assert.equal(show(r.origin, 'templates/index.json'), '{ "sections": { "a": 2 } }');
    assert.match(show(r.origin, 'config/settings_schema.json'), /"theme_version": "2\.46\.0"/);
    assert.match(show(r.origin, 'package.json'), /"version": "2\.46\.0"/);
    assert.equal(show(r.origin, 'stores/norway/templates/index.json'), '{ "no": 2 }');
  });

  it('clean merge still produces a [hotfix-backport] merge commit', () => {
    const r = scenario({
      source: 'staging-euro',
      isDefault: true,
      base,
      mainChanges: { 'package.json': pkg('2.46.0') },
      sourceChanges: { 'snippets/card.liquid': 'card v2\n' },
    });
    assert.equal(r.status, 0, r.output);
    assert.equal(show(r.origin, 'snippets/card.liquid'), 'card v2');
    assert.match(git(r.origin, 'log', '-1', '--format=%s', 'main'), /\[hotfix-backport\]/);
  });
});
