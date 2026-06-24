import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildSchemas, listSchemaFiles, listSectionsWithSchemaRefs } from '../../src/lib/schema-builder.js';

describe('schema-builder', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-schema-'));
    mkdirSync(join(cwd, '_schemas'), { recursive: true });
    mkdirSync(join(cwd, 'sections'), { recursive: true });
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  // ── Basic schema injection ────────────────────────────────────────

  it('injects a JSON schema below the inline-comment marker', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'hero-banner.json'),
        JSON.stringify({
          name: 'Hero Banner',
          settings: [{ label: 'Title', id: 'title', type: 'text' }],
        }),
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'hero-banner.liquid'),
        `<div>hero</div>\n{% # schema 'hero-banner' %}\n`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 1);
      assert.strictEqual(errors.length, 0);

      const output = readFileSync(join(dir, 'sections', 'hero-banner.liquid'), 'utf-8');
      assert.match(output, /{% # schema 'hero-banner' %}/);
      assert.match(output, /{% schema %}/);
      assert.match(output, /"name": "Hero Banner"/);
      assert.match(output, /"id": "title"/);
      assert.match(output, /{% endschema %}/);
    } finally {
      teardown();
    }
  });

  it('injects a schema from a JS module (CommonJS)', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'landing.js'),
        `module.exports = {
  name: 'Landing Page',
  settings: [{ label: 'Heading', id: 'heading', type: 'text' }],
  blocks: []
};`,
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'landing.liquid'),
        `<div>landing</div>\n{% # schema 'landing' %}\n`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 1);
      assert.strictEqual(errors.length, 0);

      const output = readFileSync(join(dir, 'sections', 'landing.liquid'), 'utf-8');
      assert.match(output, /"name": "Landing Page"/);
      assert.match(output, /"id": "heading"/);
    } finally {
      teardown();
    }
  });

  // ── Marker is preserved ───────────────────────────────────────────

  it('preserves the inline-comment marker after building', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'test.json'),
        JSON.stringify({ name: 'Test', settings: [] }),
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'test.liquid'),
        `<div>test</div>\n{% # schema 'test' %}\n`,
        'utf-8'
      );

      buildSchemas({ cwd: dir });
      const output = readFileSync(join(dir, 'sections', 'test.liquid'), 'utf-8');
      assert.match(output, /{% # schema 'test' %}/);
    } finally {
      teardown();
    }
  });

  // ── Rebuild replaces the generated block ──────────────────────────

  it('replaces the previously generated schema on rebuild (idempotent)', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'hero.json'),
        JSON.stringify({ name: 'Hero v1', settings: [] }),
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'hero.liquid'),
        `<div>hero</div>\n{% # schema 'hero' %}\n`,
        'utf-8'
      );

      buildSchemas({ cwd: dir });
      const firstBuild = readFileSync(join(dir, 'sections', 'hero.liquid'), 'utf-8');
      assert.match(firstBuild, /"name": "Hero v1"/);

      writeFileSync(
        join(dir, '_schemas', 'hero.json'),
        JSON.stringify({ name: 'Hero v2', settings: [{ id: 'new', type: 'text', label: 'New' }] }),
        'utf-8'
      );

      buildSchemas({ cwd: dir });
      const secondBuild = readFileSync(join(dir, 'sections', 'hero.liquid'), 'utf-8');
      assert.match(secondBuild, /"name": "Hero v2"/);
      assert.match(secondBuild, /"id": "new"/);
      assert.doesNotMatch(secondBuild, /"name": "Hero v1"/);

      assert.match(secondBuild, /{% # schema 'hero' %}/);

      const schemaBlocks = secondBuild.match(/{% schema %}/g);
      assert.strictEqual(schemaBlocks.length, 1);
    } finally {
      teardown();
    }
  });

  // ── Shared schema ─────────────────────────────────────────────────

  it('injects the same schema into multiple sections (shared)', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'seasonal.js'),
        `module.exports = {
  name: 'Seasonal Landing',
  settings: [{ label: 'Image', id: 'image', type: 'image_picker' }]
};`,
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'autumn-winter.liquid'),
        `<div>AW</div>\n{% # schema 'seasonal' %}\n`,
        'utf-8'
      );
      writeFileSync(
        join(dir, 'sections', 'spring-summer.liquid'),
        `<div>SS</div>\n{% # schema 'seasonal' %}\n`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 2);
      assert.strictEqual(errors.length, 0);

      for (const file of ['autumn-winter.liquid', 'spring-summer.liquid']) {
        const output = readFileSync(join(dir, 'sections', file), 'utf-8');
        assert.match(output, /"name": "Seasonal Landing"/);
      }
    } finally {
      teardown();
    }
  });

  // ── Schema with partials ──────────────────────────────────────────

  it('supports schema partials via require()', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '_schemas', 'partials'), { recursive: true });

      writeFileSync(
        join(dir, '_schemas', 'partials', 'hero-banner.js'),
        `module.exports = [
  { label: 'Heading', id: 'heading', type: 'text' },
  { label: 'Subheading', id: 'subheading', type: 'richtext' }
];`,
        'utf-8'
      );

      writeFileSync(
        join(dir, '_schemas', 'hero-banner.js'),
        `const settings = require('./partials/hero-banner.js');
module.exports = { name: 'Hero Banner', settings };`,
        'utf-8'
      );

      writeFileSync(
        join(dir, '_schemas', 'landing-page.js'),
        `const heroBannerSettings = require('./partials/hero-banner.js');
module.exports = {
  name: 'Landing Page',
  blocks: [{ type: 'hero_banner', name: 'Hero Banner', settings: heroBannerSettings }]
};`,
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'hero-banner.liquid'),
        `<div>hero</div>\n{% # schema 'hero-banner' %}\n`,
        'utf-8'
      );
      writeFileSync(
        join(dir, 'sections', 'landing-page.liquid'),
        `<div>landing</div>\n{% # schema 'landing-page' %}\n`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 2);
      assert.strictEqual(errors.length, 0);

      const heroOutput = readFileSync(join(dir, 'sections', 'hero-banner.liquid'), 'utf-8');
      assert.match(heroOutput, /"name": "Hero Banner"/);
      assert.match(heroOutput, /"id": "heading"/);

      const landingOutput = readFileSync(join(dir, 'sections', 'landing-page.liquid'), 'utf-8');
      assert.match(landingOutput, /"name": "Landing Page"/);
      assert.match(landingOutput, /"type": "hero_banner"/);
    } finally {
      teardown();
    }
  });

  // ── Common fieldsets with spread ───────────────────────────────────

  it('supports common fieldsets spread into settings arrays', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '_schemas', 'partials'), { recursive: true });

      writeFileSync(
        join(dir, '_schemas', 'partials', 'link.js'),
        `module.exports = [
  { label: 'Link Text', id: 'link_text', type: 'text' },
  { label: 'Link URL', id: 'link_url', type: 'url' }
];`,
        'utf-8'
      );

      writeFileSync(
        join(dir, '_schemas', 'hero-with-link.js'),
        `const linkSettings = require('./partials/link.js');
module.exports = {
  name: 'Hero With Link',
  settings: [
    { label: 'Title', id: 'title', type: 'text' },
    ...linkSettings
  ]
};`,
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'hero-with-link.liquid'),
        `<div>hero link</div>\n{% # schema 'hero-with-link' %}\n`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 1);
      assert.strictEqual(errors.length, 0);

      const output = readFileSync(join(dir, 'sections', 'hero-with-link.liquid'), 'utf-8');
      const parsed = JSON.parse(output.match(/{% schema %}\n([\s\S]+?)\n{% endschema %}/)[1]);
      assert.strictEqual(parsed.settings.length, 3);
      assert.strictEqual(parsed.settings[0].id, 'title');
      assert.strictEqual(parsed.settings[1].id, 'link_text');
      assert.strictEqual(parsed.settings[2].id, 'link_url');
    } finally {
      teardown();
    }
  });

  // ── Looping fieldsets ─────────────────────────────────────────────

  it('supports looping fieldsets via factory functions', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, '_schemas', 'partials'), { recursive: true });

      writeFileSync(
        join(dir, '_schemas', 'partials', 'create-links.js'),
        `module.exports = function createLinks(total) {
  total = total || 1;
  return new Array(total).fill(null).flatMap(function(_, index) {
    var n = index + 1;
    return [
      { label: 'Link Text ' + n, id: 'link_text_' + n, type: 'text' },
      { label: 'Link URL ' + n, id: 'link_url_' + n, type: 'url' }
    ];
  });
};`,
        'utf-8'
      );

      writeFileSync(
        join(dir, '_schemas', 'hero-multi-link.js'),
        `const createLinks = require('./partials/create-links.js');
module.exports = {
  name: 'Hero Multi Link',
  settings: [
    { label: 'Title', id: 'title', type: 'text' },
    ...createLinks(3)
  ]
};`,
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'hero-multi-link.liquid'),
        `<div>hero multi</div>\n{% # schema 'hero-multi-link' %}\n`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 1);
      assert.strictEqual(errors.length, 0);

      const output = readFileSync(join(dir, 'sections', 'hero-multi-link.liquid'), 'utf-8');
      const parsed = JSON.parse(output.match(/{% schema %}\n([\s\S]+?)\n{% endschema %}/)[1]);
      assert.strictEqual(parsed.settings.length, 7);
      assert.strictEqual(parsed.settings[0].id, 'title');
      assert.strictEqual(parsed.settings[1].id, 'link_text_1');
      assert.strictEqual(parsed.settings[6].id, 'link_url_3');
    } finally {
      teardown();
    }
  });

  // ── Function exports with inline overrides ────────────────────────

  it('supports function exports with inline-comment overrides', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'page-schema.js'),
        `module.exports = function(filename, content) {
  return {
    name: content.name || filename.replace('.liquid', ''),
    settings: [{ label: 'Heading', id: 'heading', type: 'text' }]
  };
};`,
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'about-page.liquid'),
        `<div>about</div>
{% # schema 'page-schema' %}
{% # { "name": "About Us" } %}
`,
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'contact-page.liquid'),
        `<div>contact</div>
{% # schema 'page-schema' %}
{% # { "name": "Contact" } %}
`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 2);
      assert.strictEqual(errors.length, 0);

      const aboutOutput = readFileSync(join(dir, 'sections', 'about-page.liquid'), 'utf-8');
      assert.match(aboutOutput, /"name": "About Us"/);

      const contactOutput = readFileSync(join(dir, 'sections', 'contact-page.liquid'), 'utf-8');
      assert.match(contactOutput, /"name": "Contact"/);
    } finally {
      teardown();
    }
  });

  // ── Inline merging with static exports ────────────────────────────

  it('merges inline JSON with static schema exports (inline wins)', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'mergeable.json'),
        JSON.stringify({
          name: 'Default Name',
          settings: [{ label: 'Title', id: 'title', type: 'text' }],
        }),
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'custom-section.liquid'),
        `<div>custom</div>
{% # schema 'mergeable' %}
{% # { "name": "Custom Override" } %}
`,
        'utf-8'
      );

      const { processed } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 1);

      const output = readFileSync(join(dir, 'sections', 'custom-section.liquid'), 'utf-8');
      assert.match(output, /"name": "Custom Override"/);
      assert.match(output, /"id": "title"/);
    } finally {
      teardown();
    }
  });

  // ── Inline override preserved across rebuilds ─────────────────────

  it('preserves inline override across rebuilds', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'card.json'),
        JSON.stringify({ name: 'Card', settings: [] }),
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'card.liquid'),
        `<div>card</div>
{% # schema 'card' %}
{% # { "name": "My Card" } %}
`,
        'utf-8'
      );

      buildSchemas({ cwd: dir });
      const first = readFileSync(join(dir, 'sections', 'card.liquid'), 'utf-8');
      assert.match(first, /"name": "My Card"/);
      assert.match(first, /{% # \{ "name": "My Card" \} %}/);

      buildSchemas({ cwd: dir });
      const second = readFileSync(join(dir, 'sections', 'card.liquid'), 'utf-8');
      assert.strictEqual(first, second);
    } finally {
      teardown();
    }
  });

  // ── Dry run ───────────────────────────────────────────────────────

  it('does not write files in dry run mode', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'banner.json'),
        JSON.stringify({ name: 'Banner', settings: [] }),
        'utf-8'
      );

      const original = `<div>banner</div>\n{% # schema 'banner' %}\n`;
      writeFileSync(join(dir, 'sections', 'banner.liquid'), original, 'utf-8');

      const { processed } = buildSchemas({ cwd: dir, dryRun: true });

      assert.strictEqual(processed.length, 1);
      const output = readFileSync(join(dir, 'sections', 'banner.liquid'), 'utf-8');
      assert.strictEqual(output, original);
    } finally {
      teardown();
    }
  });

  // ── Error handling ────────────────────────────────────────────────

  it('reports errors for missing schema files', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, 'sections', 'broken.liquid'),
        `<div>broken</div>\n{% # schema 'nonexistent' %}\n`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 0);
      assert.strictEqual(errors.length, 1);
      assert.match(errors[0].error, /Schema file not found/);
    } finally {
      teardown();
    }
  });

  it('returns empty results when sections/ does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'climaybe-schema-'));
    try {
      const { processed, skipped, errors } = buildSchemas({ cwd: dir });
      assert.strictEqual(processed.length, 0);
      assert.strictEqual(skipped.length, 0);
      assert.strictEqual(errors.length, 0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('skips section files without the marker', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, 'sections', 'static-section.liquid'),
        `<div>static</div>\n{% schema %}\n{"name":"Static"}\n{% endschema %}\n`,
        'utf-8'
      );

      const { processed, skipped } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 0);
      assert.strictEqual(skipped.length, 1);
      assert.strictEqual(skipped[0], 'sections/static-section.liquid');
    } finally {
      teardown();
    }
  });

  // ── Whitespace-control variants ───────────────────────────────────

  it('handles whitespace-control dashes in the marker', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'ws-test.json'),
        JSON.stringify({ name: 'WS Test', settings: [] }),
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'ws-test.liquid'),
        `<div>ws</div>\n{%- # schema 'ws-test' -%}\n`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 1);
      assert.strictEqual(errors.length, 0);

      const output = readFileSync(join(dir, 'sections', 'ws-test.liquid'), 'utf-8');
      assert.match(output, /"name": "WS Test"/);
    } finally {
      teardown();
    }
  });

  it('supports double-quoted schema names', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'dq-test.json'),
        JSON.stringify({ name: 'DQ Test', settings: [] }),
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'dq-test.liquid'),
        `<div>dq</div>\n{% # schema "dq-test" %}\n`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 1);
      assert.strictEqual(errors.length, 0);
    } finally {
      teardown();
    }
  });

  // ── Theme editor survival ─────────────────────────────────────────

  it('rebuilds correctly after theme editor modifies markup above the marker', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'hero.json'),
        JSON.stringify({ name: 'Hero', settings: [{ id: 'title', type: 'text', label: 'Title' }] }),
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'hero.liquid'),
        `<div>hero</div>\n{% # schema 'hero' %}\n`,
        'utf-8'
      );

      buildSchemas({ cwd: dir });

      let content = readFileSync(join(dir, 'sections', 'hero.liquid'), 'utf-8');
      content = content.replace('<div>hero</div>', '<section class="hero-edited">\n  <h1>Updated</h1>\n</section>');
      writeFileSync(join(dir, 'sections', 'hero.liquid'), content, 'utf-8');

      const { processed, errors } = buildSchemas({ cwd: dir });
      assert.strictEqual(processed.length, 1);
      assert.strictEqual(errors.length, 0);

      const output = readFileSync(join(dir, 'sections', 'hero.liquid'), 'utf-8');
      assert.match(output, /hero-edited/);
      assert.match(output, /<h1>Updated<\/h1>/);
      assert.match(output, /"name": "Hero"/);
    } finally {
      teardown();
    }
  });

  // ── blocks/ support ────────────────────────────────────────────────

  it('processes blocks/*.liquid files alongside sections/', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, 'blocks'), { recursive: true });

      writeFileSync(
        join(dir, '_schemas', 'card.json'),
        JSON.stringify({ name: 'Card Block', settings: [{ id: 'title', type: 'text', label: 'Title' }] }),
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'hero.liquid'),
        `<div>hero</div>\n{% # schema 'card' %}\n`,
        'utf-8'
      );
      writeFileSync(
        join(dir, 'blocks', 'card.liquid'),
        `<div>card block</div>\n{% # schema 'card' %}\n`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(errors.length, 0);
      assert.strictEqual(processed.length, 2);

      const names = processed.map((p) => p.section).sort();
      assert.deepStrictEqual(names, ['blocks/card.liquid', 'sections/hero.liquid']);

      const blockOutput = readFileSync(join(dir, 'blocks', 'card.liquid'), 'utf-8');
      assert.match(blockOutput, /"name": "Card Block"/);

      const sectionOutput = readFileSync(join(dir, 'sections', 'hero.liquid'), 'utf-8');
      assert.match(sectionOutput, /"name": "Card Block"/);
    } finally {
      teardown();
    }
  });

  it('lists blocks with schema markers in listSectionsWithSchemaRefs', () => {
    const dir = setup();
    try {
      mkdirSync(join(dir, 'blocks'), { recursive: true });

      writeFileSync(
        join(dir, 'blocks', 'slide.liquid'),
        `<div>slide</div>\n{% # schema 'slide-schema' %}\n`,
        'utf-8'
      );

      const refs = listSectionsWithSchemaRefs(dir);
      assert.strictEqual(refs.length, 1);
      assert.strictEqual(refs[0].section, 'blocks/slide.liquid');
      assert.deepStrictEqual(refs[0].schemas, ['slide-schema']);
    } finally {
      teardown();
    }
  });

  // ── listSchemaFiles ───────────────────────────────────────────────

  it('lists available schema files', () => {
    const dir = setup();
    try {
      writeFileSync(join(dir, '_schemas', 'a.js'), 'module.exports = {};', 'utf-8');
      writeFileSync(join(dir, '_schemas', 'b.json'), '{}', 'utf-8');
      writeFileSync(join(dir, '_schemas', 'readme.md'), '# Readme', 'utf-8');

      const files = listSchemaFiles(dir);
      assert.deepStrictEqual(files, ['a.js', 'b.json']);
    } finally {
      teardown();
    }
  });

  it('returns empty array when _schemas/ does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'climaybe-schema-'));
    try {
      assert.deepStrictEqual(listSchemaFiles(dir), []);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  // ── listSectionsWithSchemaRefs ────────────────────────────────────

  it('lists sections that contain the inline-comment marker', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, 'sections', 'has-ref.liquid'),
        `<div>ref</div>\n{% # schema 'my-schema' %}\n`,
        'utf-8'
      );
      writeFileSync(
        join(dir, 'sections', 'no-ref.liquid'),
        `<div>no ref</div>\n{% schema %}\n{}\n{% endschema %}\n`,
        'utf-8'
      );

      const refs = listSectionsWithSchemaRefs(dir);
      assert.strictEqual(refs.length, 1);
      assert.strictEqual(refs[0].section, 'sections/has-ref.liquid');
      assert.deepStrictEqual(refs[0].schemas, ['my-schema']);
    } finally {
      teardown();
    }
  });

  it('returns empty array when sections/ does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'climaybe-schema-'));
    try {
      assert.deepStrictEqual(listSectionsWithSchemaRefs(dir), []);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
