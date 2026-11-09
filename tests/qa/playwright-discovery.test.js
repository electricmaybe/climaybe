import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  buildStoreQaPlaywrightDiscovery,
  pathMatchesTestMatch,
} from '../../src/qa/lib/playwright-discovery.js';
import { selectTests, loadSelectionRules } from '../../src/qa/lib/selection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED_DIR = join(__dirname, '../../src/qa/playwright');

describe('store QA playwright discovery', () => {
  /** @type {string} */
  let themeRoot;

  before(() => {
    themeRoot = mkdtempSync(join(tmpdir(), 'climaybe-qa-specs-'));
    mkdirSync(join(themeRoot, 'qa', 'specs'), { recursive: true });
    writeFileSync(
      join(themeRoot, 'qa', 'specs', 'car-finder.spec.js'),
      "import { test } from '@playwright/test';\ntest('theme car finder @car', async () => {});\n",
      'utf8'
    );
    writeFileSync(
      join(themeRoot, 'qa', 'specs', 'cart-drawer.spec.js'),
      "import { test } from '@playwright/test';\ntest('theme cart drawer @cart', async () => {});\n",
      'utf8'
    );
    // Simulate climaybe installed under the theme's node_modules
    const pkgPlaywright = join(
      themeRoot,
      'node_modules',
      'climaybe',
      'src',
      'qa',
      'playwright'
    );
    mkdirSync(join(pkgPlaywright, 'journeys'), { recursive: true });
    mkdirSync(join(pkgPlaywright, 'universal'), { recursive: true });
    writeFileSync(
      join(pkgPlaywright, 'journeys', 'purchase-funnel.spec.js'),
      "import { test } from '@playwright/test';\ntest('J1 purchase funnel @funnel @purchase', async () => {});\n",
      'utf8'
    );
    writeFileSync(
      join(pkgPlaywright, 'universal', 'forms.spec.js'),
      "import { test } from '@playwright/test';\ntest('U forms @forms', async () => {});\n",
      'utf8'
    );
  });

  after(() => {
    rmSync(themeRoot, { recursive: true, force: true });
  });

  it('picks up theme qa/specs and shared journeys/universal via testMatch', () => {
    const sharedDir = join(themeRoot, 'node_modules', 'climaybe', 'src', 'qa', 'playwright');
    const discovery = buildStoreQaPlaywrightDiscovery({
      themeRoot,
      sharedDir,
      cliArgs: ['node', 'playwright', 'test', '-c', 'playwright.config.js'],
    });

    assert.equal(discovery.testDir, themeRoot);
    assert.equal(discovery.explicitCliPaths, false);
    assert.ok(discovery.themeSpecsDir);

    assert.equal(
      pathMatchesTestMatch('qa/specs/car-finder.spec.js', discovery.testMatch),
      true,
      'theme car spec must match testMatch'
    );
    assert.equal(
      pathMatchesTestMatch('qa/specs/cart-drawer.spec.js', discovery.testMatch),
      true,
      'theme cart spec must match testMatch'
    );
    assert.equal(
      pathMatchesTestMatch(
        'node_modules/climaybe/src/qa/playwright/journeys/purchase-funnel.spec.js',
        discovery.testMatch
      ),
      true,
      'shared funnel must still match'
    );
    assert.equal(
      pathMatchesTestMatch(
        'node_modules/climaybe/src/qa/playwright/universal/forms.spec.js',
        discovery.testMatch
      ),
      true,
      'shared universal must still match'
    );
    // Old journeys/universal-only filter would miss theme specs:
    const legacy = ['**/journeys/**/*.spec.js', '**/universal/**/*.spec.js'];
    assert.equal(pathMatchesTestMatch('qa/specs/car-finder.spec.js', legacy), false);
  });

  it('drops the narrow filter when an explicit qa/specs path is passed on the CLI', () => {
    const discovery = buildStoreQaPlaywrightDiscovery({
      themeRoot,
      sharedDir: SHARED_DIR,
      cliArgs: ['test', '-c', 'cfg.js', 'qa/specs'],
    });
    assert.equal(discovery.explicitCliPaths, true);
    assert.equal(pathMatchesTestMatch('qa/specs/car-finder.spec.js', discovery.testMatch), true);
    assert.equal(pathMatchesTestMatch('car-finder.spec.js', discovery.testMatch), true);
  });

  it('honors diff-based tag selection so only matching theme specs would run under --grep', () => {
    const rules = loadSelectionRules();
    const carSel = selectTests(
      ['_scripts/find-your-car-popup.js', 'snippets/m--find-your-car-popup.liquid'],
      rules
    );
    const cartSel = selectTests(['snippets/cart--drawer.liquid'], rules);

    assert.ok(carSel.tags.includes('@car'));
    assert.ok(carSel.tags.includes('@funnel'));
    assert.equal(carSel.tags.includes('@cart'), false);
    assert.ok(cartSel.tags.includes('@cart'));
    assert.ok(cartSel.tags.includes('@funnel'));
    assert.equal(cartSel.tags.includes('@car'), false);

    // Simulate Playwright --grep over discovered titles using whole-tag tokens
    // (@car must not false-positive on @cart).
    const titleHasSelectedTag = (title, tags) =>
      tags.some((tag) => new RegExp(`${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(title));

    const carTitle = 'theme car finder @car';
    const cartTitle = 'theme cart drawer @cart';
    const funnelTitle = 'J1 purchase funnel @funnel @purchase';

    assert.equal(titleHasSelectedTag(carTitle, carSel.tags), true);
    assert.equal(titleHasSelectedTag(funnelTitle, carSel.tags), true);
    assert.equal(titleHasSelectedTag(cartTitle, carSel.tags), false);

    assert.equal(titleHasSelectedTag(cartTitle, cartSel.tags), true);
    assert.equal(titleHasSelectedTag(funnelTitle, cartSel.tags), true);
    assert.equal(titleHasSelectedTag(carTitle, cartSel.tags), false);

    // Theme files are discoverable so --grep has something to filter
    const discovery = buildStoreQaPlaywrightDiscovery({
      themeRoot,
      sharedDir: join(themeRoot, 'node_modules', 'climaybe', 'src', 'qa', 'playwright'),
      cliArgs: [],
    });
    assert.equal(pathMatchesTestMatch('qa/specs/car-finder.spec.js', discovery.testMatch), true);
    assert.equal(pathMatchesTestMatch('qa/specs/cart-drawer.spec.js', discovery.testMatch), true);
  });
});
