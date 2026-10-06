import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { writeConfig } from '../../src/lib/config.js';
import {
  buildHarnessValues,
  renderTemplate,
  scaffoldHarness,
  HARNESS_FILES,
} from '../../src/lib/harness.js';
import { AI_RULES_ENTRY, createBridge, scaffoldAiConfig } from '../../src/lib/cursor-bundle.js';

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function writeSingleStoreConfig(dir, extra = {}) {
  writeConfig(
    {
      project_type: 'theme',
      default_store: 'demo.myshopify.com',
      base_branch: 'staging',
      stores: { demo: 'demo.myshopify.com' },
      preview_workflows: true,
      ...extra,
    },
    dir
  );
}

function writeMultiStoreConfig(dir) {
  writeConfig(
    {
      project_type: 'theme',
      default_store: 'a.myshopify.com',
      base_branch: 'staging',
      linear_team: 'EM',
      stores: {
        alpha: 'a.myshopify.com',
        beta: 'b.myshopify.com',
      },
      preview_workflows: true,
      build_workflows: true,
    },
    dir
  );
}

describe('harness scaffold', () => {
  let cwd;

  function setup(name = 'climaybe-harness-') {
    cwd = mkdtempSync(join(tmpdir(), name));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true, force: true });
  }

  it('renderTemplate substitutes {{KEY}} values only', () => {
    assert.strictEqual(renderTemplate('Hi {{NAME}} {{MISSING}}', { NAME: 'x' }), 'Hi x {{MISSING}}');
  });

  it('fresh single-store theme creates all harness files with single-store AGENTS.md', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ name: 'aisle-demo', version: '1.0.0' }),
        'utf-8'
      );
      writeSingleStoreConfig(dir);

      const result = scaffoldHarness({
        cwd: dir,
        climaybeVersion: '3.13.0',
        date: '2026-04-06',
      });

      assert.strictEqual(result.created.length, HARNESS_FILES.length);
      assert.strictEqual(result.skipped.length, 0);

      for (const file of HARNESS_FILES) {
        assert.ok(existsSync(join(dir, file.relativePath)), file.relativePath);
      }

      const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      assert.ok(agents.includes('aisle-demo'));
      assert.ok(agents.includes('demo.myshopify.com'));
      assert.ok(agents.includes('staging -> main') || agents.includes('`staging -> main`'));
      assert.ok(agents.includes('Base branch'));
      assert.ok(agents.includes('`staging`'));
      assert.ok(!agents.includes('## Multi-store'));
      assert.ok(!agents.includes('climaybe switch'));

      const initPath = join(dir, 'init.sh');
      const mode = lstatSync(initPath).mode & 0o111;
      assert.ok(mode !== 0, 'init.sh should be executable');
      const syntax = spawnSync('bash', ['-n', initPath], { encoding: 'utf-8' });
      assert.strictEqual(syntax.status, 0, syntax.stderr);

      const features = JSON.parse(readFileSync(join(dir, 'feature_list.json'), 'utf-8'));
      assert.ok(features.snapshot);
      assert.strictEqual(features.snapshot.captured_at, null);
      assert.ok(features.features.some((f) => f.id === 'harness-baseline'));

      const cfg = JSON.parse(readFileSync(join(dir, 'climaybe.config.json'), 'utf-8'));
      assert.strictEqual(cfg.harness, true);
    } finally {
      teardown();
    }
  });

  it('multi-store config lists aliases, domains, and stores/ sync rules', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'multi-theme' }), 'utf-8');
      writeMultiStoreConfig(dir);
      scaffoldHarness({ cwd: dir, climaybeVersion: '3.13.0', date: '2026-04-06' });
      const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      assert.ok(agents.includes('## Multi-store'));
      assert.ok(agents.includes('alpha'));
      assert.ok(agents.includes('a.myshopify.com'));
      assert.ok(agents.includes('beta'));
      assert.ok(agents.includes('b.myshopify.com'));
      assert.ok(agents.includes('staging-<alias>') || agents.includes('`staging-<alias>`'));
      assert.ok(agents.includes('live-<alias>') || agents.includes('`live-<alias>`'));
      assert.ok(agents.includes('stores/<alias>/') || agents.includes('`stores/<alias>/`'));
      assert.ok(agents.includes('climaybe switch'));
      assert.ok(agents.includes('climaybe sync'));
    } finally {
      teardown();
    }
  });

  it('skips existing harness files byte-identically and creates only missing ones', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'partial' }), 'utf-8');
      writeSingleStoreConfig(dir);
      const customAgents = '# custom AGENTS\nkeep me\n';
      const customProgress = '# custom progress\n';
      writeFileSync(join(dir, 'AGENTS.md'), customAgents, 'utf-8');
      writeFileSync(join(dir, 'progress.md'), customProgress, 'utf-8');

      const result = scaffoldHarness({ cwd: dir });
      assert.ok(result.skipped.includes('AGENTS.md'));
      assert.ok(result.skipped.includes('progress.md'));
      assert.ok(result.created.includes('init.sh'));
      assert.strictEqual(readFileSync(join(dir, 'AGENTS.md'), 'utf-8'), customAgents);
      assert.strictEqual(readFileSync(join(dir, 'progress.md'), 'utf-8'), customProgress);
      assert.ok(existsSync(join(dir, 'init.sh')));
    } finally {
      teardown();
    }
  });

  it('is idempotent: second run creates nothing and leaves hashes unchanged', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'idem' }), 'utf-8');
      writeSingleStoreConfig(dir);
      scaffoldHarness({ cwd: dir, climaybeVersion: '3.13.0', date: '2026-04-06' });
      const hashes = Object.fromEntries(
        HARNESS_FILES.map((f) => [f.relativePath, hashFile(join(dir, f.relativePath))])
      );
      const second = scaffoldHarness({ cwd: dir, climaybeVersion: '3.13.0', date: '2026-04-06' });
      assert.strictEqual(second.created.length, 0);
      assert.strictEqual(second.skipped.length, HARNESS_FILES.length);
      for (const f of HARNESS_FILES) {
        assert.strictEqual(hashFile(join(dir, f.relativePath)), hashes[f.relativePath]);
      }
    } finally {
      teardown();
    }
  });

  it('missing package.json: succeeds, uses folder name, warns, does not create package.json', () => {
    const dir = setup('my-folder-theme-');
    try {
      writeSingleStoreConfig(dir);
      const result = scaffoldHarness({ cwd: dir });
      assert.ok(result.created.includes('AGENTS.md'));
      assert.ok(result.warnings.some((w) => /package\.json/i.test(w)));
      assert.ok(!existsSync(join(dir, 'package.json')));
      const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      assert.ok(agents.includes(result.values.THEME_NAME));
      const init = readFileSync(join(dir, 'init.sh'), 'utf-8');
      assert.ok(init.includes('no package.json') || init.includes('SKIP'));
    } finally {
      teardown();
    }
  });

  it('non-git directory: writes files, warns, does not run git init', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'nogit' }), 'utf-8');
      writeSingleStoreConfig(dir);
      const result = scaffoldHarness({ cwd: dir });
      assert.ok(result.warnings.some((w) => /not a git repository/i.test(w)));
      assert.ok(existsSync(join(dir, 'AGENTS.md')));
      assert.ok(!existsSync(join(dir, '.git')));
    } finally {
      teardown();
    }
  });

  it('--dry-run writes nothing and lists what would be created', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'dry' }), 'utf-8');
      writeSingleStoreConfig(dir);
      const result = scaffoldHarness({ cwd: dir, dryRun: true, markEnabled: false });
      assert.ok(result.created.length > 0);
      assert.ok(!existsSync(join(dir, 'AGENTS.md')));
      assert.ok(!existsSync(join(dir, 'init.sh')));
      const cfg = JSON.parse(readFileSync(join(dir, 'climaybe.config.json'), 'utf-8'));
      assert.notStrictEqual(cfg.harness, true);
    } finally {
      teardown();
    }
  });

  it('re-points Climaybe rules.md symlinks for AGENTS.md/CLAUDE.md only', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'bridge' }), 'utf-8');
      writeSingleStoreConfig(dir);
      mkdirSync(join(dir, '.config', 'ai'), { recursive: true });
      writeFileSync(join(dir, AI_RULES_ENTRY), 'rules', 'utf-8');
      symlinkSync(relative(dir, join(dir, AI_RULES_ENTRY)), join(dir, 'AGENTS.md'));
      symlinkSync(relative(dir, join(dir, AI_RULES_ENTRY)), join(dir, 'CLAUDE.md'));
      // Foreign symlink must stay untouched.
      writeFileSync(join(dir, 'other.md'), 'x', 'utf-8');
      symlinkSync('other.md', join(dir, 'progress.md'));

      scaffoldHarness({ cwd: dir, climaybeVersion: '3.13.0', date: '2026-04-06' });

      assert.ok(!lstatSync(join(dir, 'AGENTS.md')).isSymbolicLink());
      assert.ok(readFileSync(join(dir, 'AGENTS.md'), 'utf-8').includes('Constitution'));
      assert.ok(!lstatSync(join(dir, 'CLAUDE.md')).isSymbolicLink());
      assert.ok(readFileSync(join(dir, 'CLAUDE.md'), 'utf-8').includes('AGENTS.md'));
      assert.ok(lstatSync(join(dir, 'progress.md')).isSymbolicLink());
    } finally {
      teardown();
    }
  });

  it('buildHarnessValues prefers dev_store over default_store', () => {
    const dir = setup();
    try {
      writeConfig(
        {
          stores: { a: 'a.myshopify.com' },
          default_store: 'a.myshopify.com',
          dev_store: 'dev.myshopify.com',
        },
        dir
      );
      const values = buildHarnessValues(dir);
      assert.strictEqual(values.DEV_STORE, 'dev.myshopify.com');
    } finally {
      teardown();
    }
  });
});

describe('harness + AI bridges', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-harness-bridge-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true, force: true });
  }

  it('createBridge never overwrites a regular AGENTS.md / CLAUDE.md', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'AGENTS.md'), 'real agents\n', 'utf-8');
      writeFileSync(join(dir, 'CLAUDE.md'), 'real claude\n', 'utf-8');
      mkdirSync(join(dir, '.config', 'ai'), { recursive: true });
      writeFileSync(join(dir, AI_RULES_ENTRY), 'rules\n', 'utf-8');

      const agents = createBridge(dir, { link: 'AGENTS.md', target: AI_RULES_ENTRY, kind: 'file' });
      const claude = createBridge(dir, { link: 'CLAUDE.md', target: AI_RULES_ENTRY, kind: 'file' });
      assert.strictEqual(agents.mode, 'skipped');
      assert.strictEqual(claude.mode, 'skipped');
      assert.strictEqual(readFileSync(join(dir, 'AGENTS.md'), 'utf-8'), 'real agents\n');
      assert.strictEqual(readFileSync(join(dir, 'CLAUDE.md'), 'utf-8'), 'real claude\n');
    } finally {
      teardown();
    }
  });

  it('after harness, add-cursor/update leaves real files; rules.md CLAUDE symlink re-points to AGENTS.md', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'theme' }), 'utf-8');
      writeSingleStoreConfig(dir, { harness: true, cursor_skills: true, ai_editors: ['claude', 'agents'] });
      scaffoldHarness({ cwd: dir, climaybeVersion: '3.13.0', date: '2026-04-06' });
      const agentsBefore = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      const claudeBefore = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');

      // Simulate a leftover Climaybe CLAUDE.md symlink to rules.md (e.g. from older install).
      rmSync(join(dir, 'CLAUDE.md'), { force: true });
      mkdirSync(join(dir, '.config', 'ai'), { recursive: true });
      writeFileSync(join(dir, AI_RULES_ENTRY), 'rules\n', 'utf-8');
      symlinkSync(relative(dir, join(dir, AI_RULES_ENTRY)), join(dir, 'CLAUDE.md'));

      const result = scaffoldAiConfig(dir, { editors: ['claude', 'agents'], harness: true });
      assert.strictEqual(readFileSync(join(dir, 'AGENTS.md'), 'utf-8'), agentsBefore);
      // CLAUDE.md symlink was replaceable → now points at AGENTS.md
      assert.ok(lstatSync(join(dir, 'CLAUDE.md')).isSymbolicLink());
      const target = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');
      assert.ok(target.includes('Constitution') || target.includes('AGENTS.md') || target === agentsBefore);
      // Real AGENTS was skipped
      assert.ok(result.bridges.some((b) => b.link === 'AGENTS.md' && b.mode === 'skipped'));

      // Foreign symlink CLAUDE.md target (not rules.md) stays if we restore one — covered via createBridge skip of non-rules paths in harness tests.
      void claudeBefore;
    } finally {
      teardown();
    }
  });

  it('harness leaves CLAUDE.md untouched when it is a symlink not pointing at rules.md', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'theme' }), 'utf-8');
      writeSingleStoreConfig(dir);
      writeFileSync(join(dir, 'elsewhere.md'), 'nope\n', 'utf-8');
      symlinkSync('elsewhere.md', join(dir, 'CLAUDE.md'));
      const result = scaffoldHarness({ cwd: dir });
      assert.ok(result.skipped.includes('CLAUDE.md'));
      assert.ok(lstatSync(join(dir, 'CLAUDE.md')).isSymbolicLink());
      assert.strictEqual(readFileSync(join(dir, 'CLAUDE.md'), 'utf-8'), 'nope\n');
    } finally {
      teardown();
    }
  });
});
