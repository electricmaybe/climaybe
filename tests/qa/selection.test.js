import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectTests,
  loadSelectionRules,
  pathMatchesGlob,
  resolveScope,
  blockedTagsForFailures,
  skippedByImplication,
  viewportsToProjects,
  buildFailClosedFullSuiteSelection,
} from '../../src/qa/lib/selection.js';

describe('store QA selection', () => {
  const rules = loadSelectionRules();

  it('loads mapping rules with always-run funnel tags', () => {
    assert.ok(Array.isArray(rules.rules) && rules.rules.length > 5);
    assert.ok(rules.alwaysTags.includes('@funnel'));
  });

  it('matches product section globs to pdp tags', () => {
    assert.equal(pathMatchesGlob('sections/product--form.liquid', 'sections/product--*'), true);
    assert.equal(pathMatchesGlob('docs/readme.md', 'sections/product--*'), false);
  });

  it('skips browsers for non-theme diffs (no preview) but still tags funnel for theme PRs', () => {
    const docsOnly = selectTests(['docs/README.md'], rules);
    assert.equal(docsOnly.skipBrowser, true);
    assert.equal(docsOnly.themeFileCount, 0);
    assert.ok(docsOnly.tags.includes('@funnel'));
    assert.ok(docsOnly.tags.includes('@purchase'));
  });

  it('maps cart snippet changes to cart + funnel and always runs browsers', () => {
    const sel = selectTests(
      ['snippets/cart--drawer.liquid', 'snippets/header--cart-bubble.liquid'],
      rules
    );
    assert.equal(sel.skipBrowser, false);
    assert.ok(sel.themeFileCount >= 2);
    assert.equal(sel.scope, 'small');
    assert.ok(sel.tags.includes('@cart'));
    assert.ok(sel.tags.includes('@funnel'));
    assert.ok(sel.matchedRules.includes('cart'));
    assert.deepEqual(sel.viewports, ['mobile', 'desktop']);
  });

  it('maps car-finder files to @car', () => {
    const sel = selectTests(['_scripts/find-your-car-popup.js', 'snippets/m--find-your-car-popup.liquid'], rules);
    assert.ok(sel.tags.includes('@car'));
    assert.ok(sel.matchedRules.includes('car-finder'));
  });

  it('forces release scope for layout/theme.liquid', () => {
    const sel = selectTests(['layout/theme.liquid'], rules);
    assert.equal(sel.scope, 'release');
    assert.equal(sel.fullSuite, true);
    assert.deepEqual(sel.viewports, ['mobile', 'tablet', 'desktop']);
  });

  it('uses medium scope for 6–30 theme files', () => {
    const files = Array.from({ length: 8 }, (_, i) => `sections/s--block-${i}.liquid`);
    const sel = selectTests(files, rules);
    assert.equal(sel.scope, 'medium');
    assert.deepEqual(sel.viewports, ['mobile', 'tablet', 'desktop']);
  });

  it('treats staging→main style PR as release via branch opts', () => {
    const scope = resolveScope(['snippets/x.liquid'], rules, {
      headBranch: 'staging',
      baseBranch: 'main',
    });
    assert.equal(scope, 'release');
  });

  it('treats staging-alias→live-alias as release', () => {
    const scope = resolveScope(['snippets/x.liquid'], rules, {
      headBranch: 'staging-euro',
      baseBranch: 'live-euro',
    });
    assert.equal(scope, 'release');
  });

  it('maps viewports to Playwright projects', () => {
    assert.deepEqual(viewportsToProjects(['mobile', 'desktop']), [
      'mobile-webkit',
      'desktop-chromium',
    ]);
  });

  it('blocks dependent tags when a gatekeeper fails', () => {
    const blocked = blockedTagsForFailures(['@funnel-smoke'], rules);
    assert.ok(blocked.includes('*'));
  });

  it('blocks all qty steps when variant-change fails (not a bare @funnel-qty stub)', () => {
    const blocked = blockedTagsForFailures(['@variant-change'], rules);
    assert.ok(blocked.includes('@funnel-qty-increase'));
    assert.ok(blocked.includes('@funnel-qty-decrease'));
    assert.ok(blocked.includes('@funnel-remove'));
    assert.ok(blocked.includes('@funnel-add-to-cart'));
    assert.ok(blocked.includes('@funnel-checkout'));
    assert.equal(blocked.includes('@funnel-qty'), false);
  });

  it('skips implied tags when a later step is proven', () => {
    const skips = skippedByImplication(['@funnel-qty-increase'], rules);
    assert.ok(skips.includes('@funnel-add-to-cart'));
  });

  it('builds a grep alternation from selected tags', () => {
    const sel = selectTests(['sections/cart--drawer.liquid'], rules);
    assert.match(sel.grep, /@funnel/);
    assert.match(sel.grep, /@cart/);
  });

  it('buildFailClosedFullSuiteSelection matches the true release tag union', () => {
    const release = selectTests(['layout/theme.liquid'], rules, { forceRelease: true });
    const failClosed = buildFailClosedFullSuiteSelection({ rules });

    assert.equal(failClosed.scope, 'release');
    assert.equal(failClosed.fullSuite, true);
    assert.equal(failClosed.skipBrowser, false);
    assert.equal(failClosed.selectionFailed, true);
    assert.ok(failClosed.themeFileCount >= 1);
    assert.deepEqual(failClosed.browserProjects, [
      'mobile-webkit',
      'tablet-webkit',
      'desktop-chromium',
    ]);
    // Must be the real release union — not a funnel-only stub.
    assert.deepEqual(failClosed.tags, release.tags);
    assert.equal(failClosed.grep, release.grep);
    assert.ok(failClosed.tags.includes('@cart'));
    assert.ok(failClosed.tags.includes('@pdp'));
    assert.ok(failClosed.tags.includes('@nav'));
    assert.notEqual(failClosed.grep, '@funnel|@purchase');
    assert.match(failClosed.grep, /@cart/);
    assert.match(failClosed.grep, /@pdp/);
    assert.ok(failClosed.manualIds.length >= release.manualIds.length);
    assert.ok(failClosed.matchedRules.includes('layout-head'));
  });
});
