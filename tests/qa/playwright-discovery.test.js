import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  existsSync,
  realpathSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildStoreQaPlaywrightDiscovery } from '../../src/qa/lib/playwright-discovery.js';
import { selectTests, loadSelectionRules } from '../../src/qa/lib/selection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIMAYBE_ROOT = join(__dirname, '../..');
const CONFIG = join(CLIMAYBE_ROOT, 'src/qa/playwright/playwright.config.js');
const THEME_MARKER = 'THEME_QA_SPEC_MARKER_car @car';
const SHARED_MARKER = 'J1 purchase funnel'; // real packaged funnel title prefix

describe('store QA playwright discovery', () => {
  /** @type {string} */
  let themeRoot;

  before(() => {
    themeRoot = mkdtempSync(join(tmpdir(), 'climaybe-qa-list-'));
    mkdirSync(join(themeRoot, 'qa', 'specs'), { recursive: true });
    mkdirSync(join(themeRoot, 'node_modules'), { recursive: true });
    writeFileSync(
      join(themeRoot, 'qa', 'specs', 'car-finder.spec.js'),
      [
        "import { test } from '@playwright/test';",
        `test('${THEME_MARKER}', async () => {});`,
        '',
      ].join('\n'),
      'utf8'
    );

    // Realistic install: climaybe lives under the theme's node_modules
    symlinkSync(CLIMAYBE_ROOT, join(themeRoot, 'node_modules', 'climaybe'));
    // Theme specs resolve @playwright/test from the theme tree
    const pwPkg = join(CLIMAYBE_ROOT, 'node_modules', '@playwright');
    if (existsSync(pwPkg)) {
      symlinkSync(pwPkg, join(themeRoot, 'node_modules', '@playwright'));
    }
  });

  after(() => {
    rmSync(themeRoot, { recursive: true, force: true });
  });

  it('builds dual projects: shared package dir + theme qa/specs (not theme-root testDir)', () => {
    const sharedDir = join(themeRoot, 'node_modules', 'climaybe', 'src', 'qa', 'playwright');
    const discovery = buildStoreQaPlaywrightDiscovery({
      themeRoot,
      sharedDir,
      deviceProjects: [{ name: 'desktop-chromium', use: {} }],
    });
    assert.equal(discovery.projects.length, 2);
    assert.equal(discovery.projects[0].name, 'desktop-chromium');
    assert.equal(discovery.projects[0].testDir, sharedDir);
    assert.equal(discovery.projects[1].name, 'desktop-chromium-theme');
    assert.equal(discovery.projects[1].testDir, join(themeRoot, 'qa', 'specs'));
    // Must not use theme root as shared testDir (Playwright skips node_modules there)
    assert.notEqual(discovery.projects[0].testDir, themeRoot);
  });

  it('playwright test --list finds packaged AND theme specs under node_modules/climaybe', () => {
    const configViaNodeModules = join(
      themeRoot,
      'node_modules',
      'climaybe',
      'src',
      'qa',
      'playwright',
      'playwright.config.js'
    );
    assert.equal(existsSync(configViaNodeModules), true);
    assert.equal(realpathSync(configViaNodeModules), realpathSync(CONFIG));

    const listed = runPlaywrightList({
      cwd: themeRoot,
      config: configViaNodeModules,
      env: {
        QA_THEME_ROOT: themeRoot,
        QA_PROJECTS: 'desktop-chromium',
      },
    });

    const total = listed.total;
    const sharedHits = listed.lines.filter(
      (l) => l.includes(SHARED_MARKER) || /journeys\/|universal\//.test(l)
    );
    const themeHits = listed.lines.filter((l) => l.includes('THEME_QA_SPEC_MARKER_car'));

    assert.ok(
      total >= 2,
      `expected >= 2 listed tests (packaged + theme), got ${total}\n${listed.stdout}`
    );
    assert.ok(
      sharedHits.length > 0,
      `packaged journeys/universal missing from --list (node_modules skip regression)\n${listed.stdout}`
    );
    assert.ok(
      themeHits.length > 0,
      `theme qa/specs missing from --list\n${listed.stdout}`
    );

    // Record counts for the PR report / debugging
    writeFileSync(
      join(themeRoot, 'list-counts.json'),
      JSON.stringify(
        {
          total,
          sharedHits: sharedHits.length,
          themeHits: themeHits.length,
          sample: listed.lines.slice(0, 20),
        },
        null,
        2
      ) + '\n'
    );
  });

  it('honors --grep tag selection across shared and theme projects', () => {
    const configViaNodeModules = join(
      themeRoot,
      'node_modules',
      'climaybe',
      'src',
      'qa',
      'playwright',
      'playwright.config.js'
    );
    const rules = loadSelectionRules();
    const carSel = selectTests(
      ['_scripts/find-your-car-popup.js', 'snippets/m--find-your-car-popup.liquid'],
      rules
    );
    assert.ok(carSel.tags.includes('@car'));
    assert.ok(carSel.tags.includes('@funnel'));

    const carListed = runPlaywrightList({
      cwd: themeRoot,
      config: configViaNodeModules,
      grep: '@car',
      env: {
        QA_THEME_ROOT: themeRoot,
        QA_PROJECTS: 'desktop-chromium',
      },
    });
    assert.ok(
      carListed.lines.some((l) => l.includes('THEME_QA_SPEC_MARKER_car')),
      ` --grep @car should include theme spec\n${carListed.stdout}`
    );

    const funnelListed = runPlaywrightList({
      cwd: themeRoot,
      config: configViaNodeModules,
      grep: '@funnel',
      env: {
        QA_THEME_ROOT: themeRoot,
        QA_PROJECTS: 'desktop-chromium',
      },
    });
    assert.ok(
      funnelListed.lines.some((l) => l.includes(SHARED_MARKER) || /@funnel/.test(l)),
      `--grep @funnel should include packaged funnel\n${funnelListed.stdout}`
    );
    // Theme @car-only title should not match a pure @funnel grep unless it also has @funnel
    assert.equal(
      funnelListed.lines.some((l) => l.includes('THEME_QA_SPEC_MARKER_car')),
      false,
      'theme @car-only spec must not match --grep @funnel'
    );
  });
});

/**
 * @param {{ cwd: string, config: string, grep?: string, env?: Record<string,string> }} opts
 */
function runPlaywrightList(opts) {
  const cli = join(CLIMAYBE_ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
  const args = [cli, 'test', '-c', opts.config, '--list'];
  if (opts.grep) args.push('--grep', opts.grep);
  const result = spawnSync(process.execPath, args, {
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env || {}) },
    encoding: 'utf8',
    timeout: 120_000,
  });
  const stdout = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status !== 0) {
    throw new Error(`playwright --list failed (status ${result.status}):\n${stdout}`);
  }
  const lines = stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  // Playwright prints "Total: N tests in M files" (wording varies slightly by version)
  const totalMatch = stdout.match(/Total:\s*(\d+)\s*tests?/i);
  const total = totalMatch
    ? Number(totalMatch[1])
    : lines.filter((l) => /›/.test(l) || /\.spec\./.test(l)).length;
  return { stdout, lines, total, status: result.status };
}
