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

    it('skips no-op main-to-staging sync when trees are identical', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('multi', {}, dir);
        const workflowPath = join(dir, '.github', 'workflows', 'main-to-staging-stores.yml');
        const workflow = readFileSync(workflowPath, 'utf-8');

        assert.match(workflow, /is already in sync with main \(no-op\), skipping\./);
        assert.match(workflow, /git rev-parse HEAD\^\{tree\}/);
        assert.match(workflow, /git rev-parse origin\/main\^\{tree\}/);
      } finally {
        teardown();
      }
    });

    it('skips no-op hotfix backports when source and main trees match', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('multi', {}, dir);
        const workflowPath = join(dir, '.github', 'workflows', 'multistore-hotfix-to-main.yml');
        const workflow = readFileSync(workflowPath, 'utf-8');

        assert.match(workflow, /No-op backport: origin\/main and origin\/\$SOURCE trees are identical\./);
        assert.match(workflow, /git rev-parse origin\/main\^\{tree\}/);
        assert.match(workflow, /git rev-parse origin\/\$SOURCE\^\{tree\}/);
      } finally {
        teardown();
      }
    });

    it('backports store sync commits without waiting for next root edit', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('multi', {}, dir);
        const workflowPath = join(dir, '.github', 'workflows', 'multistore-hotfix-to-main.yml');
        const workflow = readFileSync(workflowPath, 'utf-8');

        assert.match(workflow, /STORE_CHANGED/);
        assert.match(workflow, /git diff --quiet "\$MERGE_BASE" "origin\/\$SOURCE" -- "stores\/\$\{SOURCE_ALIAS\}\/"/);
        assert.match(workflow, /\[ -n "\$COMMITS" \] \|\| \[ -n "\$STORE_CHANGED" \]/);
      } finally {
        teardown();
      }
    });

    it('keeps live minified assets out of main hotfix backports', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('multi', {}, dir);
        const workflowPath = join(dir, '.github', 'workflows', 'multistore-hotfix-to-main.yml');
        const workflow = readFileSync(workflowPath, 'utf-8');

        assert.match(workflow, /':!assets\/'/);
        assert.match(workflow, /grep -v "chore\(assets\)"/);
      } finally {
        teardown();
      }
    });

    it('ignores no-op commits in nightly hotfix tagging', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('single', {}, dir);
        const workflowPath = join(dir, '.github', 'workflows', 'nightly-hotfix.yml');
        const workflow = readFileSync(workflowPath, 'utf-8');

        assert.match(workflow, /git diff-tree --quiet --no-commit-id -r "\$SHA"/);
        assert.match(workflow, /Skipping no-op commit \(empty tree diff\): \$SHA/);
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
        const hasMulti = files.includes('cleanup-orphan-preview-themes.yml');
        const hasPublish = files.includes('reusable-publish-pr-preview-store.yml');
        const prUpdate = readFileSync(join(workflowsDir, 'pr-update.yml'), 'utf-8');
        const prClose = readFileSync(join(workflowsDir, 'pr-close.yml'), 'utf-8');
        const orphanCleanup = readFileSync(join(workflowsDir, 'cleanup-orphan-preview-themes.yml'), 'utf-8');
        const publishPreview = readFileSync(join(workflowsDir, 'reusable-publish-pr-preview-store.yml'), 'utf-8');
        const commentWorkflow = readFileSync(join(workflowsDir, 'reusable-comment-on-pr.yml'), 'utf-8');
        assert.match(prUpdate, /fromJson\(needs\.validate-environment\.outputs\.preview_targets_json\)/);
        assert.match(
          prUpdate,
          /cleanup-themes:\s*\n\s*needs:\s*\[validate-environment,\s*extract-pr-number,\s*validate-secrets-per-store\]/m
        );
        assert.match(prUpdate, /HEAD_REF:\s*\$\{\{\s*github\.event\.pull_request\.head\.ref\s*\}\}/);
        assert.match(prUpdate, /const branchRef = headRef \|\| baseRef;/);
        assert.match(prClose, /HEAD_REF:\s*\$\{\{\s*github\.event\.pull_request\.head\.ref\s*\}\}/);
        assert.match(prClose, /const branchRef = headRef \|\| baseRef;/);
        assert.match(orphanCleanup, /actions:\s*write/);
        assert.match(orphanCleanup, /pull_request:\s*\n\s*types:\s*\[closed\]/m);
        assert.match(publishPreview, /path:\s*fragment-\*\.json/);
        assert.match(commentWorkflow, /climaybe-preview-comment/);
        assert.match(commentWorkflow, /issues\.updateComment/);
        assert.match(commentWorkflow, /issues\.deleteComment/);
        assert.match(prUpdate, /reusable-publish-pr-preview-store\.yml/);
        assert.ok(hasMulti, 'expected cleanup-orphan-preview-themes.yml');
        assert.ok(hasPublish, 'expected reusable-publish-pr-preview-store.yml');
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
        const reusableBuild = readFileSync(join(workflowsDir, 'reusable-build.yml'), 'utf-8');
        assert.match(reusableBuild, /Detect build entrypoints/);
        assert.match(reusableBuild, /Install dependencies from lockfile/);
        assert.match(reusableBuild, /npm ci/);
        assert.match(reusableBuild, /npx --no-install climaybe build-scripts/);
        assert.doesNotMatch(reusableBuild, /scripts_minify=true/);
        assert.doesNotMatch(reusableBuild, /build-scripts --minify/);
        assert.match(reusableBuild, /dorny\/paths-filter/);
        assert.match(reusableBuild, /Decide which build steps to run/);
        assert.match(reusableBuild, /Finalize success/);
        assert.match(reusableBuild, /git add -f assets\/\*\.js/);
        const buildPipeline = readFileSync(join(workflowsDir, 'build-pipeline.yml'), 'utf-8');
        assert.match(buildPipeline, /startsWith\(github\.ref_name, 'live-'\)/);
        assert.match(buildPipeline, /contains\(github\.actor, '\[bot\]'\)/);
      } finally {
        teardown();
      }
    });

    it('reads head commit message safely in post-merge-tag detect step', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('single', {}, dir);
        const workflowPath = join(dir, '.github', 'workflows', 'post-merge-tag.yml');
        const workflow = readFileSync(workflowPath, 'utf-8');
        assert.match(workflow, /COMMIT_MESSAGE:\s*\$\{\{\s*github\.event\.head_commit\.message\s*\}\}/);
        assert.match(workflow, /COMMIT_MSG=\$\(printf '%s\\n' "\$COMMIT_MESSAGE" \| head -1\)/);
      } finally {
        teardown();
      }
    });

    it('wires create-release to tagging workflow completion', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('single', { includeBuild: true }, dir);
        const releaseWorkflow = readFileSync(join(dir, '.github', 'workflows', 'create-release.yml'), 'utf-8');
        assert.match(releaseWorkflow, /workflow_run:/);
        assert.match(releaseWorkflow, /Post-Merge Tag/);
        assert.match(releaseWorkflow, /Nightly Hotfix Tag/);
        assert.match(releaseWorkflow, /tag_name:\s*\$\{\{\s*steps\.tag\.outputs\.tag_name\s*\}\}/);
        assert.match(releaseWorkflow, /FILTERED_COMMITS=/);
        assert.match(releaseWorkflow, /\^Sync main → staging-/);
        assert.match(releaseWorkflow, /\\\[root-to-stores\\\]/);
      } finally {
        teardown();
      }
    });

    it('does not install per-repo build script shims', () => {
      const dir = setup();
      try {
        scaffoldWorkflows('single', { includeBuild: true }, dir);
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
