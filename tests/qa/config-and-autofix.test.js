import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadQaConfig,
  resolveStoreFixtures,
  shouldRunForBaseBranch,
  matchBranchPattern,
} from '../../src/qa/lib/config-loader.js';
import {
  CURSOR_API_KEY_SECRET,
  AUTOFIX_PR_MARKER,
  commentHasAutofixMarker,
  triggerCursorAutofix,
} from '../../src/qa/lib/cursor-autofix.js';
import { renderAutoReportComment, buildAutofixPackage } from '../../src/qa/lib/report.js';
import {
  pickPreviewUrlFromComment,
  previewCommentMatchesHead,
  resolveQaStoreAlias,
  joinPreviewUrl,
} from '../../src/qa/lib/preview-url.js';
import { normalizePlaywrightResults, applyGatekeeperToRows } from '../../src/commands/store-qa.js';

describe('store QA config + autofix helpers', () => {
  it('matches live-* branch patterns', () => {
    assert.equal(matchBranchPattern('live-euro', 'live-*'), true);
    assert.equal(matchBranchPattern('staging-euro', 'live-*'), false);
    assert.equal(matchBranchPattern('main', 'main'), true);
  });

  it('defaults multi mode to live-* bases and single to main', () => {
    assert.equal(shouldRunForBaseBranch('live-euro', { mode: 'multi' }), true);
    assert.equal(shouldRunForBaseBranch('staging-euro', { mode: 'multi' }), false);
    assert.equal(shouldRunForBaseBranch('main', { mode: 'single' }), true);
    assert.equal(shouldRunForBaseBranch('staging', { mode: 'single' }), false);
  });

  it('loads qa/config.yml fixtures and hasVariants flag', () => {
    const dir = mkdtempSync(join(tmpdir(), 'climaybe-qa-cfg-'));
    try {
      mkdirSync(join(dir, 'qa'));
      writeFileSync(
        join(dir, 'qa', 'config.yml'),
        `version: 1\nbase_branches: [live-*]\nproducts:\n  has_variants: false\n  sample: /products/a\nstores:\n  - alias: euro\n    products:\n      sample: /products/a\n    collections:\n      sample: /collections/c\n`,
        'utf-8'
      );
      const { config } = loadQaConfig(dir);
      const fixtures = resolveStoreFixtures(config, 'euro');
      assert.equal(fixtures.alias, 'euro');
      assert.equal(fixtures.productPath, '/products/a');
      assert.equal(fixtures.hasVariants, false);
      assert.equal(shouldRunForBaseBranch('live-norway', { mode: 'multi', qaConfig: config }), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lets per-store features override root features (e.g. contact_path)', () => {
    const fixtures = resolveStoreFixtures(
      {
        features: { contact_path: '/pages/contact', newsletter: true },
        stores: [
          {
            alias: 'norway',
            features: { contact_path: '/pages/kontakt', newsletter: false },
          },
        ],
      },
      'norway'
    );
    assert.equal(fixtures.contactPath, '/pages/kontakt');
    assert.equal(fixtures.features.newsletter, false);
    assert.equal(fixtures.features.contact_path, '/pages/kontakt');
  });

  it('joins preview base + path without swallowing path into preview_theme_id', () => {
    const base = 'https://voldt-euro.myshopify.com/?preview_theme_id=123456789';
    const joined = joinPreviewUrl(base, '/products/sample-bike');
    const url = new URL(joined);
    assert.equal(url.origin, 'https://voldt-euro.myshopify.com');
    assert.equal(url.pathname, '/products/sample-bike');
    assert.equal(url.searchParams.get('preview_theme_id'), '123456789');
    assert.equal(joined.includes('preview_theme_id=123456789/products'), false);

    const withQuery = joinPreviewUrl(base, '/products/x?variant=9');
    const u2 = new URL(withQuery);
    assert.equal(u2.pathname, '/products/x');
    assert.equal(u2.searchParams.get('preview_theme_id'), '123456789');
    assert.equal(u2.searchParams.get('variant'), '9');

    assert.equal(
      joinPreviewUrl(base, 'https://other.example/products/y'),
      'https://other.example/products/y'
    );

    const withHash = joinPreviewUrl(base, '/products/z#reviews');
    const u3 = new URL(withHash);
    assert.equal(u3.pathname, '/products/z');
    assert.equal(u3.hash, '#reviews');
    assert.equal(u3.searchParams.get('preview_theme_id'), '123456789');

    const trailing = joinPreviewUrl(
      'https://voldt-euro.myshopify.com/?preview_theme_id=123456789',
      '/collections/all/'
    );
    assert.equal(new URL(trailing).pathname, '/collections/all/');

    assert.equal(joinPreviewUrl('', '/products/a'), '/products/a');
    assert.equal(joinPreviewUrl('', 'products/a'), '/products/a');
  });

  it('documents CURSOR_API_KEY secret name and no-ops without it', async () => {
    assert.equal(CURSOR_API_KEY_SECRET, 'CURSOR_API_KEY');
    const result = await triggerCursorAutofix({
      apiKey: '',
      repositoryUrl: 'https://github.com/electricmaybe/voldt',
      prUrl: 'https://github.com/electricmaybe/voldt/pull/1',
      headSha: 'abc1234567890',
      results: [{ id: 'J1', title: 'funnel', status: 'failed', error: 'boom' }],
    });
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'missing-secret');
  });

  it('detects autofix marker once per PR (not per SHA)', () => {
    assert.equal(
      commentHasAutofixMarker(`<!-- ${AUTOFIX_PR_MARKER} -->\nlaunched`, 'deadbeef'),
      true
    );
    assert.equal(commentHasAutofixMarker('<!-- climaybe-qa-autofix:abc1234 -->', 'zzz'), true);
    assert.equal(commentHasAutofixMarker('no marker', 'abc'), false);
  });

  it('calls Cursor API v1 only when key present', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ id: 'bc-test' });
        },
      };
    };
    const result = await triggerCursorAutofix({
      apiKey: 'test-key',
      repositoryUrl: 'https://github.com/electricmaybe/voldt',
      prUrl: 'https://github.com/electricmaybe/voldt/pull/9',
      headSha: 'fff111',
      results: [{ id: 'U06', title: 'qty', status: 'failed', error: 'expected 2' }],
      fetchImpl,
    });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, false);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/v1\/agents$/);
    assert.equal(result.marker, AUTOFIX_PR_MARKER);
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.workOnCurrentBranch, true);
    assert.ok(body.prompt.text.includes('U06'));
  });

  it('builds autofix package with all failures', () => {
    const pkg = buildAutofixPackage({
      headSha: 'abc',
      previewUrl: 'https://example.com/?preview_theme_id=1',
      results: [
        { id: 'A', title: 'a', status: 'failed', error: 'x', viewport: 'mobile-webkit' },
        { id: 'B', title: 'b', status: 'passed' },
        { id: 'C', title: 'c', status: 'failed', error: 'y' },
      ],
    });
    assert.equal(pkg.failures.length, 2);
  });

  it('renders auto report with console errors and failed-still', () => {
    const md = renderAutoReportComment({
      headSha: 'abc',
      scope: 'small',
      results: [
        { id: '1', title: 'ok', status: 'passed' },
        { id: '2', title: 'bad', status: 'failed', error: 'nope', consoleErrors: ['console: x'] },
        { id: '3', title: 'blocked', status: 'blocked' },
      ],
      consoleErrors: ['network 404: /x.js'],
      autofix: 'failed-still',
    });
    assert.match(md, /<!-- climaybe-qa-auto -->/);
    assert.match(md, /\| Failed \| 1 \|/);
    assert.match(md, /Console \/ network errors/);
    assert.match(md, /Owner action required/);
  });

  it('pins preview URL to full head SHA and store alias', () => {
    const sha = 'abcdef0123456789abcdef0123456789abcdef01';
    const body = `<!-- climaybe-preview-comment -->
<!-- climaybe-preview-sha:${sha} -->
**Commit:** ${sha}
- [euro preview](https://euro.myshopify.com/?preview_theme_id=1) · [euro editor preview](https://euro.myshopify.com/admin)
- [norway preview](https://norway.myshopify.com/?preview_theme_id=2)
`;
    assert.equal(previewCommentMatchesHead(body, sha), true);
    assert.equal(previewCommentMatchesHead(body, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'), false);
    assert.equal(
      pickPreviewUrlFromComment(body, { headSha: sha, storeAlias: 'norway' }),
      'https://norway.myshopify.com/?preview_theme_id=2'
    );
    assert.equal(pickPreviewUrlFromComment(body, { headSha: 'nope' }), null);
  });

  it('resolves store alias from live/staging branch', () => {
    assert.equal(
      resolveQaStoreAlias({ stores: [{ alias: 'euro' }, { alias: 'norway' }] }, { baseBranch: 'live-norway' }),
      'norway'
    );
    assert.equal(resolveQaStoreAlias({ default_store_alias: 'euro', stores: [] }, {}), 'euro');
  });

  it('marks dependents blocked via gatekeeper rules', () => {
    const rows = applyGatekeeperToRows([
      { id: 'U01', title: 'smoke', status: 'failed', tags: ['@funnel-smoke'] },
      { id: 'U06', title: 'qty', status: 'passed', tags: ['@funnel-qty-increase'] },
    ]);
    assert.equal(rows[0].status, 'failed');
    assert.equal(rows[1].status, 'blocked');
  });

  it('blocks qty increase, decrease, and remove when variant-change fails', () => {
    const rows = applyGatekeeperToRows([
      { id: 'U02', title: 'variant', status: 'failed', tags: ['@variant-change'] },
      { id: 'U06', title: 'qty+', status: 'passed', tags: ['@funnel-qty-increase'] },
      { id: 'U07', title: 'qty-', status: 'passed', tags: ['@funnel-qty-decrease'] },
      { id: 'U08', title: 'remove', status: 'passed', tags: ['@funnel-remove'] },
    ]);
    assert.equal(rows[0].status, 'failed');
    assert.equal(rows[1].status, 'blocked');
    assert.equal(rows[2].status, 'blocked');
    assert.equal(rows[3].status, 'blocked');
  });

  it('normalizes playwright JSON reporter shape', () => {
    const rows = normalizePlaywrightResults({
      suites: [
        {
          specs: [
            {
              title: 'J1 funnel',
              tests: [
                {
                  projectName: 'mobile-webkit',
                  status: 'unexpected',
                  results: [{ status: 'failed', errors: [{ message: 'timeout' }] }],
                },
              ],
            },
          ],
        },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'failed');
    assert.equal(rows[0].viewport, 'mobile-webkit');
  });
});
