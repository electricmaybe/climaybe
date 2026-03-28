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

  it('injects a simple JSON schema into a section file', () => {
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
        `<div>hero</div>\n{% schema 'hero-banner' %}{% endschema %}\n`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 1);
      assert.strictEqual(errors.length, 0);

      const output = readFileSync(join(dir, 'sections', 'hero-banner.liquid'), 'utf-8');
      assert.match(output, /{% schema %}/);
      assert.match(output, /"name": "Hero Banner"/);
      assert.match(output, /"id": "title"/);
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
  settings: [
    { label: 'Heading', id: 'heading', type: 'text' }
  ],
  blocks: []
};`,
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'landing.liquid'),
        `<div>landing</div>\n{% schema 'landing' %}{% endschema %}\n`,
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

  // ── Shared schema (same schema for multiple sections) ─────────────

  it('injects the same schema into multiple sections (shared schema pattern)', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'seasonal-landing.js'),
        `module.exports = {
  name: 'Seasonal Landing',
  settings: [
    { label: 'Banner Image', id: 'banner_image', type: 'image_picker' }
  ]
};`,
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'autumn-winter-2020.liquid'),
        `<div>AW20</div>\n{% schema 'seasonal-landing' %}{% endschema %}\n`,
        'utf-8'
      );
      writeFileSync(
        join(dir, 'sections', 'spring-summer-2021.liquid'),
        `<div>SS21</div>\n{% schema 'seasonal-landing' %}{% endschema %}\n`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 2);
      assert.strictEqual(errors.length, 0);

      for (const file of ['autumn-winter-2020.liquid', 'spring-summer-2021.liquid']) {
        const output = readFileSync(join(dir, 'sections', file), 'utf-8');
        assert.match(output, /"name": "Seasonal Landing"/);
        assert.match(output, /"id": "banner_image"/);
      }
    } finally {
      teardown();
    }
  });

  // ── Schema with partials (importing shared settings) ──────────────

  it('supports schema partials via require() (section as block pattern)', () => {
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
module.exports = {
  name: 'Hero Banner',
  settings
};`,
        'utf-8'
      );

      writeFileSync(
        join(dir, '_schemas', 'landing-page.js'),
        `const heroBannerSettings = require('./partials/hero-banner.js');
module.exports = {
  name: 'Landing Page',
  blocks: [
    {
      name: 'Hero Banner',
      type: 'hero_banner',
      settings: heroBannerSettings
    }
  ]
};`,
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'hero-banner.liquid'),
        `<div>hero</div>\n{% schema 'hero-banner' %}{% endschema %}\n`,
        'utf-8'
      );
      writeFileSync(
        join(dir, 'sections', 'landing-page.liquid'),
        `<div>landing</div>\n{% schema 'landing-page' %}{% endschema %}\n`,
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
      assert.match(landingOutput, /"id": "heading"/);
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
        `<div>hero link</div>\n{% schema 'hero-with-link' %}{% endschema %}\n`,
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
        `<div>hero multi</div>\n{% schema 'hero-multi-link' %}{% endschema %}\n`,
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
      assert.strictEqual(parsed.settings[2].id, 'link_url_1');
      assert.strictEqual(parsed.settings[5].id, 'link_text_3');
      assert.strictEqual(parsed.settings[6].id, 'link_url_3');
    } finally {
      teardown();
    }
  });

  // ── Section-specific overrides via function export ─────────────────

  it('supports function exports for section-specific overrides', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'page-schema.js'),
        `module.exports = function(filename, content) {
  return {
    name: content.name || filename.replace('.liquid', ''),
    settings: [
      { label: 'Heading', id: 'heading', type: 'text' }
    ]
  };
};`,
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'about-page.liquid'),
        `<div>about</div>
{% schema 'page-schema' %}
{
  "name": "About Us"
}
{% endschema %}
`,
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'contact-page.liquid'),
        `<div>contact</div>
{% schema 'page-schema' %}
{
  "name": "Contact"
}
{% endschema %}
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

  // ── Inline content merges with static exports ─────────────────────

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
{% schema 'mergeable' %}
{
  "name": "Custom Override Name"
}
{% endschema %}
`,
        'utf-8'
      );

      const { processed } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 1);

      const output = readFileSync(join(dir, 'sections', 'custom-section.liquid'), 'utf-8');
      assert.match(output, /"name": "Custom Override Name"/);
      assert.match(output, /"id": "title"/);
    } finally {
      teardown();
    }
  });

  // ── Dry run mode ──────────────────────────────────────────────────

  it('does not write files in dry run mode', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'banner.json'),
        JSON.stringify({ name: 'Banner', settings: [] }),
        'utf-8'
      );

      const original = `<div>banner</div>\n{% schema 'banner' %}{% endschema %}\n`;
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
        `<div>broken</div>\n{% schema 'nonexistent' %}{% endschema %}\n`,
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

  it('returns empty results when _schemas/ does not exist', () => {
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

  it('skips section files without schema references', () => {
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
      assert.strictEqual(skipped[0], 'static-section.liquid');
    } finally {
      teardown();
    }
  });

  // ── Whitespace-tolerant tag matching ──────────────────────────────

  it('handles Liquid whitespace-control variants ({%- -%})', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, '_schemas', 'ws-test.json'),
        JSON.stringify({ name: 'Whitespace Test', settings: [] }),
        'utf-8'
      );

      writeFileSync(
        join(dir, 'sections', 'ws-test.liquid'),
        `<div>ws</div>\n{%- schema 'ws-test' -%}{%- endschema -%}\n`,
        'utf-8'
      );

      const { processed, errors } = buildSchemas({ cwd: dir });

      assert.strictEqual(processed.length, 1);
      assert.strictEqual(errors.length, 0);

      const output = readFileSync(join(dir, 'sections', 'ws-test.liquid'), 'utf-8');
      assert.match(output, /"name": "Whitespace Test"/);
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

  it('lists sections that contain schema references', () => {
    const dir = setup();
    try {
      writeFileSync(
        join(dir, 'sections', 'has-ref.liquid'),
        `<div>ref</div>\n{% schema 'my-schema' %}{% endschema %}\n`,
        'utf-8'
      );
      writeFileSync(
        join(dir, 'sections', 'no-ref.liquid'),
        `<div>no ref</div>\n{% schema %}\n{}\n{% endschema %}\n`,
        'utf-8'
      );

      const refs = listSectionsWithSchemaRefs(dir);
      assert.strictEqual(refs.length, 1);
      assert.strictEqual(refs[0].section, 'has-ref.liquid');
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
