# Schema Builder Examples

Complete, working examples for every pattern supported by `climaybe build-schemas`.

## How it works

Add an inline-comment marker to any `sections/*.liquid` or `blocks/*.liquid` file:

```liquid
{% # schema 'hero-banner' %}
```

Shopify treats `{% # ... %}` as a comment and ignores it. The builder finds the marker in both `sections/` and `blocks/`, resolves `_schemas/hero-banner.js` (or `.json`), and writes the generated `{% schema %}...{% endschema %}` block directly below it. On subsequent builds, only the generated block is replaced — the marker and everything above it (including theme editor changes) are preserved.

**Directory layout:**

```
your-theme/
├── sections/              ← section files (with inline-comment markers)
│   ├── hero-banner.liquid
│   ├── landing-page.liquid
│   └── static-section.liquid  (no marker — left alone)
├── blocks/                ← block files (also supports markers)
│   └── card.liquid
├── _schemas/              ← schema definitions (JS or JSON)
│   ├── partials/          ← shared settings, fieldsets, helpers
│   │   ├── link.js
│   │   ├── create-links.js
│   │   └── spacing.js
│   ├── hero-banner.js
│   ├── landing-page.js
│   └── page-schema.js
```

**Commands:**

```bash
npx climaybe build-schemas              # generate schemas in sections/
npx climaybe build-schemas --dry-run    # preview without writing files
npx climaybe build-schemas --list       # list schema files and markers
```

---

## 1. Basic JSON Schema

The simplest case — a static `.json` file.

**`_schemas/announcement-bar.json`**

```json
{
  "name": "Announcement Bar",
  "settings": [
    {
      "type": "text",
      "id": "message",
      "label": "Message",
      "default": "Welcome to our store"
    },
    {
      "type": "url",
      "id": "link",
      "label": "Link"
    },
    {
      "type": "color",
      "id": "background_color",
      "label": "Background color",
      "default": "#000000"
    }
  ]
}
```

**`sections/announcement-bar.liquid`** (before build)

```liquid
<div class="announcement-bar" style="background: {{ section.settings.background_color }};">
  <a href="{{ section.settings.link }}">{{ section.settings.message }}</a>
</div>

{% # schema 'announcement-bar' %}
```

**After `npx climaybe build-schemas`:**

```liquid
<div class="announcement-bar" style="background: {{ section.settings.background_color }};">
  <a href="{{ section.settings.link }}">{{ section.settings.message }}</a>
</div>

{% # schema 'announcement-bar' %}
{% schema %}
{
  "name": "Announcement Bar",
  "settings": [
    {
      "type": "text",
      "id": "message",
      "label": "Message",
      "default": "Welcome to our store"
    },
    {
      "type": "url",
      "id": "link",
      "label": "Link"
    },
    {
      "type": "color",
      "id": "background_color",
      "label": "Background color",
      "default": "#000000"
    }
  ]
}
{% endschema %}
```

The marker stays. Only the `{% schema %}...{% endschema %}` block below it is managed by the builder.

---

## 2. Basic JS Schema (CommonJS)

Use a `.js` file when you need comments, computation, or imports.

**`_schemas/hero-banner.js`**

```js
module.exports = {
  name: 'Hero Banner',
  tag: 'section',
  class: 'hero-banner',
  settings: [
    {
      type: 'image_picker',
      id: 'image',
      label: 'Background image',
    },
    {
      type: 'text',
      id: 'heading',
      label: 'Heading',
      default: 'Welcome',
    },
    {
      type: 'richtext',
      id: 'subheading',
      label: 'Subheading',
    },
    {
      type: 'select',
      id: 'text_alignment',
      label: 'Text alignment',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
      ],
      default: 'center',
    },
  ],
  presets: [{ name: 'Hero Banner' }],
};
```

**`sections/hero-banner.liquid`**

```liquid
<section class="hero-banner">
  <!-- hero markup -->
</section>

{% # schema 'hero-banner' %}
```

---

## 3. Shared Schema (Same Schema, Multiple Sections)

One schema file, multiple section files. Change the schema once, rebuild, every section updates.

**`_schemas/seasonal-landing.js`**

```js
module.exports = {
  name: 'Seasonal Landing',
  max_blocks: 12,
  settings: [
    { type: 'image_picker', id: 'hero_image', label: 'Hero image' },
    { type: 'text', id: 'headline', label: 'Headline' },
    { type: 'richtext', id: 'description', label: 'Description' },
  ],
  blocks: [
    {
      type: 'featured_product',
      name: 'Featured Product',
      settings: [
        { type: 'product', id: 'product', label: 'Product' },
        { type: 'text', id: 'custom_label', label: 'Custom label' },
      ],
    },
  ],
};
```

**`sections/autumn-winter-2024.liquid`**

```liquid
<div class="seasonal-landing"><!-- AW markup --></div>

{% # schema 'seasonal-landing' %}
```

**`sections/spring-summer-2025.liquid`**

```liquid
<div class="seasonal-landing"><!-- SS markup --></div>

{% # schema 'seasonal-landing' %}
```

Both get identical schema JSON after build.

---

## 4. Partials — Reusing Settings (Section as Block)

Extract settings into a partial, import them as section settings in one schema and block settings in another.

**`_schemas/partials/hero-banner.js`**

```js
module.exports = [
  { type: 'image_picker', id: 'image', label: 'Background image' },
  { type: 'text', id: 'heading', label: 'Heading' },
  { type: 'richtext', id: 'subheading', label: 'Subheading' },
];
```

**`_schemas/hero-banner.js`** — uses partial as section settings:

```js
const settings = require('./partials/hero-banner.js');

module.exports = {
  name: 'Hero Banner',
  settings,
  presets: [{ name: 'Hero Banner' }],
};
```

**`_schemas/landing-page.js`** — uses same partial as a block:

```js
const heroBannerSettings = require('./partials/hero-banner.js');

module.exports = {
  name: 'Landing Page',
  blocks: [
    {
      type: 'hero_banner',
      name: 'Hero Banner',
      settings: heroBannerSettings,
    },
    {
      type: 'rich_text',
      name: 'Rich Text',
      settings: [{ type: 'richtext', id: 'content', label: 'Content' }],
    },
  ],
};
```

```liquid
<!-- sections/hero-banner.liquid -->
{% # schema 'hero-banner' %}
```

```liquid
<!-- sections/landing-page.liquid -->
{% # schema 'landing-page' %}
```

---

## 5. Common Fieldsets with Spread

Reusable field groups spread into any schema's settings.

**`_schemas/partials/link.js`**

```js
module.exports = [
  { type: 'text', id: 'link_text', label: 'Link text' },
  { type: 'url', id: 'link_url', label: 'Link URL' },
];
```

**`_schemas/partials/spacing.js`**

```js
module.exports = [
  { type: 'range', id: 'padding_top', label: 'Padding top', min: 0, max: 100, step: 4, unit: 'px', default: 40 },
  { type: 'range', id: 'padding_bottom', label: 'Padding bottom', min: 0, max: 100, step: 4, unit: 'px', default: 40 },
];
```

**`_schemas/featured-collection.js`**

```js
const linkSettings = require('./partials/link.js');
const spacingSettings = require('./partials/spacing.js');

module.exports = {
  name: 'Featured Collection',
  settings: [
    { type: 'text', id: 'title', label: 'Heading', default: 'Featured Collection' },
    { type: 'collection', id: 'collection', label: 'Collection' },
    { type: 'range', id: 'products_to_show', label: 'Products to show', min: 2, max: 12, step: 1, default: 4 },
    ...linkSettings,
    ...spacingSettings,
  ],
  presets: [{ name: 'Featured Collection' }],
};
```

Result: 7 settings. Add a field to either partial — every schema using it picks it up.

---

## 6. Looping Fieldsets via Factory Functions

Generate multiple instances of a field group.

**`_schemas/partials/create-links.js`**

```js
module.exports = function createLinks(total) {
  total = total || 1;
  return new Array(total).fill(null).flatMap(function (_, index) {
    var n = index + 1;
    return [
      { type: 'text', id: 'link_text_' + n, label: 'Link text ' + n },
      { type: 'url', id: 'link_url_' + n, label: 'Link URL ' + n },
    ];
  });
};
```

**`_schemas/hero-slideshow.js`**

```js
const createLinks = require('./partials/create-links.js');

module.exports = {
  name: 'Hero Slideshow',
  settings: [
    { type: 'checkbox', id: 'autoplay', label: 'Auto-rotate', default: true },
    ...createLinks(3),
  ],
  presets: [{ name: 'Hero Slideshow' }],
};
```

Result: 1 checkbox + 6 link fields (2 per link x 3) = 7 settings from one function call.

---

## 7. Section-Specific Overrides (Function Export)

Export a function instead of an object. It receives `(filename, inlineContent)`.

**`_schemas/page-schema.js`**

```js
module.exports = function (filename, content) {
  return {
    name: content.name || filename.replace('.liquid', ''),
    tag: 'section',
    class: content.class || 'page-section',
    settings: [
      { type: 'richtext', id: 'body', label: 'Page content' },
      { type: 'image_picker', id: 'featured_image', label: 'Featured image' },
    ],
  };
};
```

Each section provides overrides via a second inline comment:

**`sections/about-page.liquid`**

```liquid
<section class="page-section">{{ section.settings.body }}</section>

{% # schema 'page-schema' %}
{% # { "name": "About Us", "class": "about-page" } %}
```

**`sections/contact-page.liquid`**

```liquid
<section class="page-section">{{ section.settings.body }}</section>

{% # schema 'page-schema' %}
{% # { "name": "Contact" } %}
```

**`sections/faq-page.liquid`** (no override — falls back to filename)

```liquid
<section class="page-section">{{ section.settings.body }}</section>

{% # schema 'page-schema' %}
```

After build:
- `about-page.liquid` → `"name": "About Us"`
- `contact-page.liquid` → `"name": "Contact"`
- `faq-page.liquid` → `"name": "faq-page"` (from filename)

---

## 8. Inline JSON Merging (Static Export)

For **object** exports (not functions), inline JSON is **shallow-merged** on top. Inline wins.

**`_schemas/newsletter.json`**

```json
{
  "name": "Newsletter",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "Subscribe" },
    { "type": "text", "id": "button_text", "label": "Button text", "default": "Submit" }
  ],
  "presets": [{ "name": "Newsletter" }]
}
```

**`sections/newsletter.liquid`** (no override)

```liquid
{% # schema 'newsletter' %}
```

**`sections/footer-newsletter.liquid`** (overrides name)

```liquid
{% # schema 'newsletter' %}
{% # { "name": "Footer Newsletter" } %}
```

After build:
- `newsletter.liquid` → `"name": "Newsletter"`
- `footer-newsletter.liquid` → `"name": "Footer Newsletter"` (same settings, overridden name)

---

## 9. Combined Real-World Pattern

Everything together in a full theme.

### `_schemas/partials/color-scheme.js`

```js
module.exports = [
  {
    type: 'select', id: 'color_scheme', label: 'Color scheme',
    options: [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
      { value: 'accent', label: 'Accent' },
    ],
    default: 'light',
  },
];
```

### `_schemas/promotional-grid.js`

```js
const createLinks = require('./partials/create-links.js');
const colorScheme = require('./partials/color-scheme.js');
const spacingSettings = require('./partials/spacing.js');

module.exports = {
  name: 'Promotional Grid',
  settings: [
    { type: 'text', id: 'heading', label: 'Section heading' },
    { type: 'range', id: 'columns', label: 'Columns', min: 2, max: 4, step: 1, default: 3 },
    ...colorScheme,
    ...spacingSettings,
  ],
  blocks: [
    {
      type: 'promo_card',
      name: 'Promo Card',
      settings: [
        { type: 'image_picker', id: 'image', label: 'Image' },
        { type: 'text', id: 'title', label: 'Title' },
        ...createLinks(1),
      ],
    },
  ],
  presets: [
    { name: 'Promotional Grid', blocks: [{ type: 'promo_card' }, { type: 'promo_card' }, { type: 'promo_card' }] },
  ],
};
```

### `_schemas/page-template.js`

```js
const spacingSettings = require('./partials/spacing.js');
const colorScheme = require('./partials/color-scheme.js');

module.exports = function (filename, content) {
  var baseName = filename.replace('.liquid', '');
  return {
    name: content.name || baseName.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }),
    tag: 'section',
    class: content.class || baseName,
    settings: [
      { type: 'richtext', id: 'body', label: 'Content' },
      { type: 'image_picker', id: 'featured_image', label: 'Featured image' },
      ...colorScheme,
      ...spacingSettings,
    ],
  };
};
```

### Section files

**`sections/promotional-grid.liquid`**

```liquid
<section class="promo-grid">
  {% for block in section.blocks %}
    <div class="promo-card" {{ block.shopify_attributes }}><!-- card --></div>
  {% endfor %}
</section>

{% # schema 'promotional-grid' %}
```

**`sections/shipping-policy.liquid`**

```liquid
<section class="page-section">{{ section.settings.body }}</section>

{% # schema 'page-template' %}
{% # { "name": "Shipping Policy" } %}
```

**`sections/returns-policy.liquid`** (auto-generates name from filename)

```liquid
<section class="page-section">{{ section.settings.body }}</section>

{% # schema 'page-template' %}
```

After `npx climaybe build-schemas`:
- `promotional-grid.liquid` — full schema with link fields in blocks, color scheme, spacing
- `shipping-policy.liquid` — `"name": "Shipping Policy"` from inline override
- `returns-policy.liquid` — `"name": "Returns Policy"` auto-generated from filename

---

## Tips

- **No separate source folder.** Everything stays in `sections/`. `{% # ... %}` is an inline comment — Shopify ignores it.
- **Theme editor safe.** Edits above the marker are preserved. Just rebuild after pulling theme editor changes.
- **Inline overrides** use a second `{% # { ... } %}` tag below the marker.
- **Sections without markers** are completely ignored by the builder.
- **JS over JSON** for schemas that need comments, imports, or computation.
- **Partials** go in `_schemas/partials/` by convention.
- **`--dry-run`** to verify before writing, **`--list`** to see markers and references.
