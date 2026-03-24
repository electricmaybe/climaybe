import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { scaffoldWorkflows } from '../../src/lib/workflows.js';

describe('workflows', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-wf-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  describe('scaffoldWorkflows', () => {
    it('creates .github/workflows and copies shared + single by default', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('single', {}, dir);
        const workflowsDir = join(dir, '.github', 'workflows');
        assert.ok(existsSync(workflowsDir));
        const files = readdirSync(workflowsDir).filter((f) => f.endsWith('.yml'));
        assert.ok(files.length >= 1);
        const content = readFileSync(join(workflowsDir, files[0]), 'utf-8');
        assert.ok(content.length > 0);
      } finally {
        teardown();
      }
    });

    it('includes multi workflows when mode is multi', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('multi', {}, dir);
        const workflowsDir = join(dir, '.github', 'workflows');
        const files = readdirSync(workflowsDir).filter((f) => f.endsWith('.yml'));
        const hasMulti = files.some((f) =>
          ['main-to-staging-stores.yml', 'pr-to-live.yml', 'root-to-stores.yml', 'stores-to-root.yml', 'multistore-hotfix-to-main.yml'].includes(f)
        );
        assert.ok(hasMulti, 'expected at least one multi-store workflow');
      } finally {
        teardown();
      }
    });

    it('keeps live hotfixes eligible for same-store staging sync', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('multi', {}, dir);
        const workflowPath = join(dir, '.github', 'workflows', 'main-to-staging-stores.yml');
        const workflow = readFileSync(workflowPath, 'utf-8');

        assert.match(workflow, /hotfix_skip_alias/);
        assert.match(workflow, /\$SOURCE_BRANCH" == staging-\*/);
        assert.doesNotMatch(workflow, /Hotfix came from staging-\$ALIAS or live-\$ALIAS, skipping/);
      } finally {
        teardown();
      }
    });

    it('includes preview workflows when includePreview is true', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('single', { includePreview: true }, dir);
        const workflowsDir = join(dir, '.github', 'workflows');
        const files = readdirSync(workflowsDir).filter((f) => f.endsWith('.yml'));
        const hasPreview = files.some((f) => f.includes('pr-update') || f.includes('preview'));
        assert.ok(hasPreview, 'expected at least one preview workflow');
      } finally {
        teardown();
      }
    });

    it('includes build workflows when includeBuild is true', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('single', { includeBuild: true }, dir);
        const workflowsDir = join(dir, '.github', 'workflows');
        const files = readdirSync(workflowsDir).filter((f) => f.endsWith('.yml'));
        const hasBuild = files.some((f) => f.includes('build') || f.includes('release'));
        assert.ok(hasBuild, 'expected at least one build workflow');
        assert.ok(existsSync(join(dir, '.climaybe', 'build-scripts.js')));
        assert.ok(existsSync(join(dir, 'build-scripts.js')));
      } finally {
        teardown();
      }
    });

    it('removes bundled build script when includeBuild is false', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('single', { includeBuild: true }, dir);
        assert.ok(existsSync(join(dir, '.climaybe', 'build-scripts.js')));
        assert.ok(existsSync(join(dir, 'build-scripts.js')));
        scaffoldWorkflows('single', { includeBuild: false }, dir);
        assert.ok(!existsSync(join(dir, '.climaybe', 'build-scripts.js')));
        assert.ok(!existsSync(join(dir, 'build-scripts.js')));
      } finally {
        teardown();
      }
    });

    it('overwrites existing workflows on second scaffold', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('single', {}, dir);
        const first = readdirSync(join(dir, '.github', 'workflows')).filter((f) => f.endsWith('.yml')).length;
        scaffoldWorkflows('single', {}, dir);
        const second = readdirSync(join(dir, '.github', 'workflows')).filter((f) => f.endsWith('.yml')).length;
        assert.strictEqual(first, second);
      } finally {
        teardown();
      }
    });
  });
});
