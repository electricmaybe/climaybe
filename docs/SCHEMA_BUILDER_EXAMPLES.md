# Schema Builder Examples

Complete, working examples for every pattern supported by `climaybe build-schemas`. Each example shows the source files you create and the output the builder produces.

## How the build works

Shopify reads sections from `sections/`. The schema builder treats that folder as **build output**, not source.

- **`_sections/`** — your source section files (Liquid + schema references). You edit these.
- **`_schemas/`** — schema definitions as JS or JSON. Partials go in `_schemas/partials/`.
- **`sections/`** — build output. The builder copies each `_sections/*.liquid` file here, resolving any `{% schema 'name' %}` references and injecting the JSON. Sections without schema references are copied verbatim.

Your source files are never modified, so builds are always repeatable.

```
your-theme/
├── _sections/             ← source files (you edit these)
│   ├── hero-banner.liquid
│   ├── landing-page.liquid
│   ├── about-page.liquid
│   └── static-section.liquid
├── _schemas/              ← schema definitions (JS or JSON)
│   ├── partials/          ← shared settings, fieldsets, helpers
│   │   ├── link.js
│   │   ├── create-links.js
│   │   └── hero-banner.js
│   ├── hero-banner.js
│   ├── landing-page.js
│   └── page-schema.js
├── sections/              ← build output (Shopify reads this)
│   ├── hero-banner.liquid      ← generated with JSON schema injected
│   ├── landing-page.liquid     ← generated
│   ├── about-page.liquid       ← generated
│   └── static-section.liquid   ← copied verbatim (no schema ref)
```

Run the builder:

```bash
npx climaybe build-schemas              # build _sections/ → sections/
npx climaybe build-schemas --dry-run    # preview without writing files
npx climaybe build-schemas --list       # list schema files and references
```

---

## 1. Basic JSON Schema

The simplest case — define a static schema in a `.json` file.

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
    },
    {
      "type": "color",
      "id": "text_color",
      "label": "Text color",
      "default": "#ffffff"
    }
  ]
}
```

**`_sections/announcement-bar.liquid`** (source — you edit this)

```liquid
<div class="announcement-bar" style="background: {{ section.settings.background_color }}; color: {{ section.settings.text_color }};">
  <a href="{{ section.settings.link }}">{{ section.settings.message }}</a>
</div>

{% schema 'announcement-bar' %}{% endschema %}
```

**`sections/announcement-bar.liquid`** (build output — Shopify reads this)

```liquid
<div class="announcement-bar" style="background: {{ section.settings.background_color }}; color: {{ section.settings.text_color }};">
  <a href="{{ section.settings.link }}">{{ section.settings.message }}</a>
</div>

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
    },
    {
      "type": "color",
      "id": "text_color",
      "label": "Text color",
      "default": "#ffffff"
    }
  ]
}
{% endschema %}
```

---

## 2. Basic JS Schema (CommonJS)

Use a `.js` file when you want to add comments, compute values, or keep things readable.

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
  presets: [
    {
      name: 'Hero Banner',
    },
  ],
};
```

**`_sections/hero-banner.liquid`**

```liquid
<section class="hero-banner">
  <!-- hero markup -->
</section>

{% schema 'hero-banner' %}{% endschema %}
```

---

## 3. Shared Schema (Same Schema, Multiple Sections)

One schema file reused across multiple section files. Change the schema once, rebuild, every section updates.

**`_schemas/seasonal-landing.js`**

```js
module.exports = {
  name: 'Seasonal Landing',
  max_blocks: 12,
  settings: [
    {
      type: 'image_picker',
      id: 'hero_image',
      label: 'Hero image',
    },
    {
      type: 'text',
      id: 'headline',
      label: 'Headline',
    },
    {
      type: 'richtext',
      id: 'description',
      label: 'Description',
    },
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
    {
      type: 'banner',
      name: 'Promo Banner',
      settings: [
        { type: 'image_picker', id: 'banner_image', label: 'Image' },
        { type: 'url', id: 'banner_link', label: 'Link' },
      ],
    },
  ],
};
```

Both source sections reference the same schema:

**`_sections/autumn-winter-2024.liquid`**

```liquid
<div class="seasonal-landing">
  <!-- autumn/winter landing markup -->
</div>

{% schema 'seasonal-landing' %}{% endschema %}
```

**`_sections/spring-summer-2025.liquid`**

```liquid
<div class="seasonal-landing">
  <!-- spring/summer landing markup -->
</div>

{% schema 'seasonal-landing' %}{% endschema %}
```

After `npx climaybe build-schemas`, both `sections/autumn-winter-2024.liquid` and `sections/spring-summer-2025.liquid` contain identical schema JSON. Update `_schemas/seasonal-landing.js` once and rebuild — both stay in sync.

---

## 4. Partials — Reusing Settings (Section as Block)

Extract a section's settings into a partial so they can be imported as section settings in one schema and block settings in another.

**`_schemas/partials/hero-banner.js`**

```js
module.exports = [
  {
    type: 'image_picker',
    id: 'image',
    label: 'Background image',
  },
  {
    type: 'text',
    id: 'heading',
    label: 'Heading',
  },
  {
    type: 'richtext',
    id: 'subheading',
    label: 'Subheading',
  },
  {
    type: 'select',
    id: 'overlay_opacity',
    label: 'Overlay opacity',
    options: [
      { value: '0', label: 'None' },
      { value: '25', label: '25%' },
      { value: '50', label: '50%' },
      { value: '75', label: '75%' },
    ],
    default: '0',
  },
];
```

Use the partial as section settings:

**`_schemas/hero-banner.js`**

```js
const settings = require('./partials/hero-banner.js');

module.exports = {
  name: 'Hero Banner',
  settings,
  presets: [{ name: 'Hero Banner' }],
};
```

Reuse the same partial as a block type in another section:

**`_schemas/landing-page.js`**

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
      settings: [
        { type: 'richtext', id: 'content', label: 'Content' },
      ],
    },
  ],
};
```

**`_sections/hero-banner.liquid`**

```liquid
{% schema 'hero-banner' %}{% endschema %}
```

**`_sections/landing-page.liquid`**

```liquid
{% schema 'landing-page' %}{% endschema %}
```

The hero banner settings array is defined once and lives in both output schemas after build.

---

## 5. Common Fieldsets with Spread

Extract repeated field groups (like links, buttons, spacing) into partials, then spread them into any schema's settings array.

**`_schemas/partials/link.js`**

```js
module.exports = [
  {
    type: 'text',
    id: 'link_text',
    label: 'Link text',
  },
  {
    type: 'url',
    id: 'link_url',
    label: 'Link URL',
  },
];
```

**`_schemas/partials/spacing.js`**

```js
module.exports = [
  {
    type: 'range',
    id: 'padding_top',
    label: 'Padding top',
    min: 0,
    max: 100,
    step: 4,
    unit: 'px',
    default: 40,
  },
  {
    type: 'range',
    id: 'padding_bottom',
    label: 'Padding bottom',
    min: 0,
    max: 100,
    step: 4,
    unit: 'px',
    default: 40,
  },
];
```

**`_schemas/featured-collection.js`**

```js
const linkSettings = require('./partials/link.js');
const spacingSettings = require('./partials/spacing.js');

module.exports = {
  name: 'Featured Collection',
  settings: [
    {
      type: 'text',
      id: 'title',
      label: 'Heading',
      default: 'Featured Collection',
    },
    {
      type: 'collection',
      id: 'collection',
      label: 'Collection',
    },
    {
      type: 'range',
      id: 'products_to_show',
      label: 'Products to show',
      min: 2,
      max: 12,
      step: 1,
      default: 4,
    },
    ...linkSettings,
    ...spacingSettings,
  ],
  presets: [{ name: 'Featured Collection' }],
};
```

After build, the `settings` array contains 7 fields: `title`, `collection`, `products_to_show`, `link_text`, `link_url`, `padding_top`, `padding_bottom`. Add a field to either partial and every schema using it picks it up on next build.

---

## 6. Looping Fieldsets via Factory Functions

When a section needs multiple instances of the same field group (e.g. 3 links, 5 slides), use a factory function.

**`_schemas/partials/create-links.js`**

```js
module.exports = function createLinks(total) {
  total = total || 1;
  return new Array(total).fill(null).flatMap(function (_, index) {
    var n = index + 1;
    return [
      {
        type: 'text',
        id: 'link_text_' + n,
        label: 'Link text ' + n,
      },
      {
        type: 'url',
        id: 'link_url_' + n,
        label: 'Link URL ' + n,
      },
    ];
  });
};
```

**`_schemas/partials/create-slides.js`**

```js
module.exports = function createSlides(total) {
  total = total || 1;
  return new Array(total).fill(null).flatMap(function (_, index) {
    var n = index + 1;
    return [
      {
        type: 'image_picker',
        id: 'slide_image_' + n,
        label: 'Slide ' + n + ' image',
      },
      {
        type: 'text',
        id: 'slide_heading_' + n,
        label: 'Slide ' + n + ' heading',
      },
      {
        type: 'textarea',
        id: 'slide_text_' + n,
        label: 'Slide ' + n + ' text',
      },
      {
        type: 'url',
        id: 'slide_link_' + n,
        label: 'Slide ' + n + ' link',
      },
    ];
  });
};
```

**`_schemas/hero-slideshow.js`**

```js
const createLinks = require('./partials/create-links.js');
const createSlides = require('./partials/create-slides.js');

module.exports = {
  name: 'Hero Slideshow',
  settings: [
    {
      type: 'checkbox',
      id: 'autoplay',
      label: 'Auto-rotate slides',
      default: true,
    },
    {
      type: 'range',
      id: 'speed',
      label: 'Change slides every',
      min: 3,
      max: 10,
      step: 1,
      unit: 's',
      default: 5,
    },
    ...createSlides(5),
    ...createLinks(2),
  ],
  presets: [{ name: 'Hero Slideshow' }],
};
```

After build the schema has 2 global settings + 20 slide fields (4 per slide x 5) + 4 link fields (2 per link x 2) = **26 settings**, all generated from two function calls.

---

## 7. Section-Specific Overrides (Function Export)

Export a function instead of an object. The function receives `(filename, inlineContent)` — use this to customise the schema per section without duplicating it.

**`_schemas/page-schema.js`**

```js
const spacingSettings = require('./partials/spacing.js');

module.exports = function (filename, content) {
  return {
    name: content.name || filename.replace('.liquid', ''),
    tag: 'section',
    class: content.class || 'page-section',
    settings: [
      {
        type: 'richtext',
        id: 'body',
        label: 'Page content',
      },
      {
        type: 'image_picker',
        id: 'featured_image',
        label: 'Featured image',
      },
      ...spacingSettings,
    ],
  };
};
```

Each source section provides its own name and optional class via inline JSON:

**`_sections/about-page.liquid`**

```liquid
<section class="page-section {{ section.settings.class }}">
  {{ section.settings.body }}
</section>

{% schema 'page-schema' %}
{
  "name": "About Us",
  "class": "about-page"
}
{% endschema %}
```

**`_sections/contact-page.liquid`**

```liquid
<section class="page-section {{ section.settings.class }}">
  {{ section.settings.body }}
</section>

{% schema 'page-schema' %}
{
  "name": "Contact",
  "class": "contact-page"
}
{% endschema %}
```

**`_sections/faq-page.liquid`** (no inline JSON — falls back to filename)

```liquid
<section class="page-section">
  {{ section.settings.body }}
</section>

{% schema 'page-schema' %}{% endschema %}
```

After build:
- `sections/about-page.liquid` gets `"name": "About Us"`, `"class": "about-page"`
- `sections/contact-page.liquid` gets `"name": "Contact"`, `"class": "contact-page"`
- `sections/faq-page.liquid` gets `"name": "faq-page"`, `"class": "page-section"` (defaults)

---

## 8. Inline JSON Merging (Static Export)

When the schema export is an **object** (not a function), any inline JSON between the tags is **shallow-merged** on top. Inline properties win.

**`_schemas/newsletter.json`**

```json
{
  "name": "Newsletter",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Subscribe to our newsletter"
    },
    {
      "type": "text",
      "id": "button_text",
      "label": "Button text",
      "default": "Subscribe"
    }
  ],
  "presets": [
    { "name": "Newsletter" }
  ]
}
```

**`_sections/newsletter.liquid`** (no inline — gets the default name)

```liquid
{% schema 'newsletter' %}{% endschema %}
```

**`_sections/footer-newsletter.liquid`** (overrides name via inline JSON)

```liquid
{% schema 'newsletter' %}
{
  "name": "Footer Newsletter"
}
{% endschema %}
```

After build:
- `sections/newsletter.liquid` gets `"name": "Newsletter"` (unchanged)
- `sections/footer-newsletter.liquid` gets `"name": "Footer Newsletter"` (overridden), but keeps the same `settings` and `presets`

---

## 9. Combined Real-World Pattern

A full theme example pulling everything together.

### File structure

```
_schemas/
├── partials/
│   ├── link.js               ← common link fieldset
│   ├── create-links.js       ← looping link factory
│   ├── spacing.js            ← padding top/bottom
│   ├── color-scheme.js       ← reusable color scheme picker
│   └── hero-settings.js      ← hero section settings as a partial
├── hero-banner.js            ← uses hero-settings partial
├── featured-collection.js    ← uses link + spacing partials
├── promotional-grid.js       ← uses create-links factory + color-scheme
└── page-template.js          ← function export for per-page overrides

_sections/
├── hero-banner.liquid
├── featured-collection.liquid
├── promotional-grid.liquid
├── shipping-policy.liquid
└── returns-policy.liquid
```

### `_schemas/partials/color-scheme.js`

```js
module.exports = [
  {
    type: 'select',
    id: 'color_scheme',
    label: 'Color scheme',
    options: [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
      { value: 'accent', label: 'Accent' },
    ],
    default: 'light',
  },
];
```

### `_schemas/partials/hero-settings.js`

```js
const colorScheme = require('./color-scheme.js');

module.exports = [
  {
    type: 'image_picker',
    id: 'image',
    label: 'Background image',
  },
  {
    type: 'video_url',
    id: 'video_url',
    label: 'Background video URL',
    accept: ['youtube', 'vimeo'],
  },
  {
    type: 'text',
    id: 'heading',
    label: 'Heading',
  },
  {
    type: 'richtext',
    id: 'subheading',
    label: 'Subheading',
  },
  ...colorScheme,
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
    {
      type: 'text',
      id: 'heading',
      label: 'Section heading',
    },
    {
      type: 'range',
      id: 'columns',
      label: 'Columns per row',
      min: 2,
      max: 4,
      step: 1,
      default: 3,
    },
    ...colorScheme,
    ...spacingSettings,
  ],
  blocks: [
    {
      type: 'promo_card',
      name: 'Promo Card',
      settings: [
        {
          type: 'image_picker',
          id: 'image',
          label: 'Card image',
        },
        {
          type: 'text',
          id: 'title',
          label: 'Card title',
        },
        {
          type: 'textarea',
          id: 'description',
          label: 'Card description',
        },
        ...createLinks(1),
      ],
    },
  ],
  presets: [
    {
      name: 'Promotional Grid',
      blocks: [
        { type: 'promo_card' },
        { type: 'promo_card' },
        { type: 'promo_card' },
      ],
    },
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
    name: content.name || baseName.replace(/-/g, ' ').replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    }),
    tag: 'section',
    class: content.class || baseName,
    settings: [
      {
        type: 'richtext',
        id: 'body',
        label: 'Content',
      },
      {
        type: 'image_picker',
        id: 'featured_image',
        label: 'Featured image',
      },
      ...colorScheme,
      ...spacingSettings,
    ],
  };
};
```

### Source section files

**`_sections/promotional-grid.liquid`**

```liquid
<section class="promo-grid">
  {% for block in section.blocks %}
    <div class="promo-card" {{ block.shopify_attributes }}>
      <!-- card markup -->
    </div>
  {% endfor %}
</section>

{% schema 'promotional-grid' %}{% endschema %}
```

**`_sections/shipping-policy.liquid`** (uses function export, custom name)

```liquid
<section class="page-section">
  {{ section.settings.body }}
</section>

{% schema 'page-template' %}
{
  "name": "Shipping Policy"
}
{% endschema %}
```

**`_sections/returns-policy.liquid`** (uses function export, auto-generates name)

```liquid
<section class="page-section">
  {{ section.settings.body }}
</section>

{% schema 'page-template' %}{% endschema %}
```

After `npx climaybe build-schemas`:
- `sections/promotional-grid.liquid` gets the full schema with looped link fields inside each block, shared color scheme and spacing
- `sections/shipping-policy.liquid` gets `"name": "Shipping Policy"` from inline JSON
- `sections/returns-policy.liquid` gets `"name": "Returns Policy"` auto-generated from the filename

---

## Tips

- **`_sections/` is source, `sections/` is output.** Edit files in `_sections/`, never in `sections/` directly (they get overwritten on build). Sections that don't use dynamic schemas can stay in `sections/` and won't be touched.
- **JS over JSON** for schemas that benefit from comments, imports, or computation. JSON for simple static schemas.
- **Partials go in `_schemas/partials/`** by convention — they are not directly referenced by sections, only imported by other schema files.
- **Rebuild after changes**: run `npx climaybe build-schemas` after editing `_sections/` or `_schemas/` files.
- **Use `--dry-run`** to verify output before writing.
- **Use `--list`** to see which source sections reference which schemas.
- **Whitespace control**: the builder matches both `{% schema 'x' %}` and `{%- schema 'x' -%}` variants.
- **Cache busting**: the builder clears the Node require cache before each load, so changes are picked up without restarting.
- **`.gitignore`**: consider adding `sections/` to `.gitignore` if all your sections use the builder (generated output). If some sections are static and some are built, only put the built ones in `_sections/`.
