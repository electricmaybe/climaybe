import { mkdtempSync, rmSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import assert from 'node:assert';

const SRC = join(process.cwd(), 'src', 'workflows');
const hasJq = spawnSync('jq', ['--version']).status === 0;
const hasBash = spawnSync('bash', ['--version']).status === 0;

/** Return the `run: |` body of the step with the given name, dedented. */
function extractRun(yml, stepName) {
  const lines = yml.split('\n');
  const start = lines.findIndex((l) => l.trim() === `- name: ${stepName}`);
  assert.ok(start >= 0, `step not found: ${stepName}`);
  const runIdx = lines.findIndex((l, i) => i > start && /^\s+run: \|\s*$/.test(l));
  const indent = lines[runIdx].match(/^(\s*)/)[1].length + 2;
  const body = [];
  for (let i = runIdx + 1; i < lines.length; i += 1) {
    const l = lines[i];
    if (l.trim() !== '' && l.match(/^(\s*)/)[1].length < indent) break;
    body.push(l.slice(indent));
  }
  return body.join('\n');
}

describe('pr-to-live theme lookup', () => {
  const yml = readFileSync(join(SRC, 'multi', 'pr-to-live.yml'), 'utf-8');
  const script = extractRun(yml, 'Create PR to live branch');
  const jqProgram = script.match(/--arg repo "\$REPO_NAME" --arg branch "\$STAGING" '\n([\s\S]*?)\n\s*' 2>\/dev\/null/)[1];

  function lookup(input) {
    const r = spawnSync('jq', ['-r', '--arg', 'repo', 'voldt', '--arg', 'branch', 'staging-euro', jqProgram], { input });
    return { status: r.status, out: r.stdout.toString().trim(), err: r.stderr.toString() };
  }

  it('does not fail the step when theme lookup fails', () => {
    assert.match(script, /--json 2>\/dev\/null \|\| true\)/);
    assert.match(script, /' 2>\/dev\/null \| head -n 1 \|\| true\)/);
  });

  it('handles Shopify CLI 5 {"themes": [...]} output (string ids, live role)', { skip: !hasJq }, () => {
    const input = JSON.stringify({
      themes: [
        { id: '194177073486', name: 'voldt/live-euro', role: 'live', processing: false },
        { id: '1', name: 'voldt/staging-euro', role: 'live', processing: false },
        { id: '190000000001', name: 'voldt/staging-euro', role: 'unpublished', processing: false },
      ],
    });
    assert.deepStrictEqual(lookup(input), { status: 0, out: '190000000001', err: '' });
  });

  it('handles legacy bare-array output and the "main" role', { skip: !hasJq }, () => {
    const input = JSON.stringify([
      { id: 5, name: 'voldt/staging-euro', role: 'main' },
      { id: 6, name: 'voldt/staging-euro', role: 'unpublished' },
    ]);
    assert.strictEqual(lookup(input).out, '6');
  });

  it('handles multi-environment output and suffix fallback', { skip: !hasJq }, () => {
    const input = JSON.stringify({
      environments: [{ environment: 'euro', result: { themes: [{ id: '77', name: 'renamed/staging-euro', role: 'unpublished' }] } }],
    });
    assert.strictEqual(lookup(input).out, '77');
  });

  it('returns nothing (exit 0) for empty/no-match/null-name input', { skip: !hasJq }, () => {
    assert.deepStrictEqual(lookup(''), { status: 0, out: '', err: '' });
    assert.strictEqual(lookup('{"themes":[]}').out, '');
    assert.strictEqual(lookup('[]').out, '');
    assert.strictEqual(lookup('{"themes":[{"id":"9","name":null,"role":null}]}').out, '');
  });
});

describe('ai-changelog provider fallback', () => {
  const yml = readFileSync(join(SRC, 'shared', 'ai-changelog.yml'), 'utf-8');
  const script = extractRun(yml, 'Generate changelog (Gemini -> static fallback)');

  it('drops retired endpoints and keeps the API key out of the URL', () => {
    assert.doesNotMatch(yml, /models\.inference\.ai\.azure\.com/);
    assert.doesNotMatch(yml, /gemini-2\.0-flash/);
    assert.doesNotMatch(yml, /\?key=/);
    assert.match(yml, /x-goog-api-key/);
    const release = readFileSync(join(SRC, 'build', 'create-release.yml'), 'utf-8');
    assert.doesNotMatch(release, /gemini-2\.0-flash/);
    assert.doesNotMatch(release, /\?key=/);
  });

  function runWith(mode, { key = 'dummy', commits = 'abc1234 feat: add thing\ndef5678 fix: bug\nfff0000 misc\n' } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'climaybe-cl-'));
    try {
      mkdirSync(join(dir, 'bin'));
      const fake = `#!/usr/bin/env bash
out=""; while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift;; esac; shift; done
w(){ printf '%s' "$1" > "$out"; }
case "${mode}" in
  dns) echo "curl: (6) Could not resolve host" >&2; printf 000; exit 6;;
  h404) w '{"error":{"message":"model not found"}}'; printf 404;;
  garbage) w 'not json'; printf 200;;
  ok) w '{"candidates":[{"content":{"parts":[{"text":"x","thought":true},{"text":"## Fixes\\n- Fixed it"}]}}]}'; printf 200;;
esac
`;
      writeFileSync(join(dir, 'bin', 'curl'), fake);
      chmodSync(join(dir, 'bin', 'curl'), 0o755);
      writeFileSync(join(dir, 'commits-for-ai.txt'), commits);
      writeFileSync(join(dir, 'out'), '');
      writeFileSync(join(dir, 'step.sh'), script);
      const r = spawnSync('bash', ['-e', 'step.sh'], {
        cwd: dir,
        env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, GEMINI_API_KEY: key, GEMINI_MODEL: '', GITHUB_OUTPUT: 'out' },
      });
      return { status: r.status, log: r.stdout.toString() + r.stderr.toString(), out: readFileSync(join(dir, 'out'), 'utf-8') };
    } finally {
      rmSync(dir, { recursive: true });
    }
  }

  for (const mode of ['dns', 'h404', 'garbage']) {
    it(`falls back to static changelog on ${mode}`, { skip: !(hasJq && hasBash) }, () => {
      const r = runWith(mode);
      assert.strictEqual(r.status, 0, r.log);
      assert.match(r.log, /Changelog provider: static-fallback/);
      assert.match(r.out, /## Features\n- feat: add thing/);
      assert.match(r.out, /## Fixes\n- fix: bug/);
      assert.match(r.out, /## Chore\n- misc/);
    });
  }

  it('uses Gemini text (skipping thought parts) on success', { skip: !(hasJq && hasBash) }, () => {
    const r = runWith('ok');
    assert.strictEqual(r.status, 0, r.log);
    assert.match(r.log, /Changelog provider: gemini/);
    assert.match(r.out, /changelog<<(CHANGELOG_EOF_[0-9a-f]+)\n## Fixes\n- Fixed it\n\1\n/);
  });

  it('works without GEMINI_API_KEY', { skip: !(hasJq && hasBash) }, () => {
    const r = runWith('dns', { key: '' });
    assert.strictEqual(r.status, 0, r.log);
    assert.doesNotMatch(r.log, /curl/);
    assert.match(r.log, /static-fallback/);
  });
});
