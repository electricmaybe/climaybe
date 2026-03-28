import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SCHEMA_DIR = '_schemas';

// Matches the inline-comment marker: {% # schema 'name' %}
// Supports whitespace-control dashes and single or double quotes.
const MARKER_REGEX =
  /\{%-?\s*#\s*schema\s+['"]([^'"]+)['"]\s*-?%\}/;

// Matches the marker, then an optional inline-override marker, then an
// optional existing generated {% schema %}...{% endschema %} block, all the
// way to end-of-file.
// Group 1: full marker tag
// Group 2: schema name
// Group 3: content between marker and generated block (may contain override)
// Group 4: existing generated block (may be undefined on first build)
const MARKER_WITH_OUTPUT_REGEX =
  /(\{%-?\s*#\s*schema\s+['"]([^'"]+)['"]\s*-?%\})([\s\S]*?)(\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\})?\s*$/;

// Matches an inline-comment override: {% # { "name": "Custom" } %}
const INLINE_OVERRIDE_REGEX =
  /\{%-?\s*#\s*(\{[\s\S]*?\})\s*-?%\}/;

/**
 * Resolve a schema source file (.js or .json) from the schemas directory.
 */
function resolveSchemaFile(schemasDir, name) {
  const jsPath = join(schemasDir, `${name}.js`);
  if (existsSync(jsPath)) return jsPath;
  const jsonPath = join(schemasDir, `${name}.json`);
  if (existsSync(jsonPath)) return jsonPath;
  return null;
}

/**
 * Load a schema module. CommonJS `.js` files are loaded via `createRequire`;
 * `.json` files are parsed directly. Cache is busted on every load so
 * rebuilds pick up changes without restarting the process.
 */
function loadSchemaModule(schemasDir, absolutePath) {
  if (absolutePath.endsWith('.json')) {
    return JSON.parse(readFileSync(absolutePath, 'utf-8'));
  }

  const localRequire = createRequire(join(schemasDir, '_entry.js'));
  const resolved = localRequire.resolve(absolutePath);
  delete localRequire.cache[resolved];
  return localRequire(resolved);
}

/**
 * Parse optional inline JSON.
 */
function parseInlineContent(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return {};
  }
}

/**
 * Evaluate the schema export.
 *
 * - **Function exports** receive `(filename, inlineContent)` and must return
 *   the schema object.
 * - **Object exports** are shallow-merged with any inline content (inline wins).
 */
function evaluateSchema(schemaExport, sectionFilename, inlineContent) {
  const raw = schemaExport?.default ?? schemaExport;
  if (typeof raw === 'function') {
    return raw(sectionFilename, inlineContent);
  }
  const hasInline = inlineContent && typeof inlineContent === 'object' && Object.keys(inlineContent).length > 0;
  if (hasInline) {
    return { ...raw, ...inlineContent };
  }
  return raw;
}

/**
 * Build section schemas for a Shopify theme project.
 *
 * Scans `sections/*.liquid` for an inline-comment marker:
 *
 *   {% # schema 'hero-banner' %}
 *
 * When found, resolves `_schemas/hero-banner.js` (or `.json`), evaluates it,
 * and writes (or replaces) the generated `{% schema %}...{% endschema %}`
 * block directly below the marker. The marker is never removed, so rebuilds
 * always work — even after Shopify theme editor edits.
 *
 * Optional per-section overrides use a second inline comment:
 *
 *   {% # schema 'name' %}
 *   {% # { "name": "Custom Name" } %}
 *   {% schema %}...{% endschema %}
 *
 * @param {object}  options
 * @param {string}  [options.cwd]    Theme project root (default `process.cwd()`).
 * @param {boolean} [options.dryRun] When true, compute schemas without writing files.
 * @returns {{ processed: Array<{section: string, schemaName: string}>, skipped: string[], errors: Array<{section: string, schema: string, error: string}> }}
 */
export function buildSchemas({ cwd = process.cwd(), dryRun = false } = {}) {
  const schemasDir = join(cwd, SCHEMA_DIR);
  const sectionsDir = join(cwd, 'sections');

  if (!existsSync(sectionsDir)) {
    return { processed: [], skipped: [], errors: [] };
  }

  const sectionFiles = readdirSync(sectionsDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.liquid'))
    .map((d) => d.name)
    .sort();

  if (sectionFiles.length === 0) {
    return { processed: [], skipped: [], errors: [] };
  }

  const processed = [];
  const skipped = [];
  const errors = [];

  for (const sectionFile of sectionFiles) {
    const sectionPath = join(sectionsDir, sectionFile);
    const content = readFileSync(sectionPath, 'utf-8');

    if (!MARKER_REGEX.test(content)) {
      skipped.push(sectionFile);
      continue;
    }

    if (!existsSync(schemasDir)) {
      errors.push({
        section: sectionFile,
        schema: '(unknown)',
        error: '_schemas/ directory not found',
      });
      continue;
    }

    const fullMatch = content.match(MARKER_WITH_OUTPUT_REGEX);
    if (!fullMatch) {
      skipped.push(sectionFile);
      continue;
    }

    const marker = fullMatch[1];
    const schemaName = fullMatch[2];
    const betweenContent = fullMatch[3] || '';

    const schemaFile = resolveSchemaFile(schemasDir, schemaName);
    if (!schemaFile) {
      errors.push({
        section: sectionFile,
        schema: schemaName,
        error: `Schema file not found: _schemas/${schemaName}.js or .json`,
      });
      continue;
    }

    try {
      const schemaExport = loadSchemaModule(schemasDir, schemaFile);

      let inlineContent = {};
      const inlineMatch = betweenContent.match(INLINE_OVERRIDE_REGEX);
      if (inlineMatch) {
        inlineContent = parseInlineContent(inlineMatch[1]);
      }

      const schema = evaluateSchema(schemaExport, sectionFile, inlineContent);
      const json = JSON.stringify(schema, null, 2);
      const generatedBlock = `{% schema %}\n${json}\n{% endschema %}`;

      const markerIndex = content.indexOf(marker);
      const beforeMarker = content.substring(0, markerIndex);

      let inlineOverrideBlock = '';
      if (inlineMatch) {
        inlineOverrideBlock = '\n' + inlineMatch[0];
      }

      const newContent = beforeMarker + marker + inlineOverrideBlock + '\n' + generatedBlock + '\n';

      if (!dryRun) {
        writeFileSync(sectionPath, newContent, 'utf-8');
      }
      processed.push({ section: sectionFile, schemaName });
    } catch (err) {
      errors.push({
        section: sectionFile,
        schema: schemaName,
        error: err.message,
      });
    }
  }

  return { processed, skipped, errors };
}

/**
 * List available schema source files in `_schemas/`.
 */
export function listSchemaFiles(cwd = process.cwd()) {
  const schemasDir = join(cwd, SCHEMA_DIR);
  if (!existsSync(schemasDir)) return [];
  return readdirSync(schemasDir, { withFileTypes: true })
    .filter((d) => d.isFile() && (d.name.endsWith('.js') || d.name.endsWith('.json')))
    .map((d) => d.name)
    .sort();
}

/**
 * List section files that contain the inline-comment schema marker.
 */
export function listSectionsWithSchemaRefs(cwd = process.cwd()) {
  const sectionsDir = join(cwd, 'sections');
  if (!existsSync(sectionsDir)) return [];

  const results = [];
  const files = readdirSync(sectionsDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.liquid'));

  for (const file of files) {
    const content = readFileSync(join(sectionsDir, file.name), 'utf-8');
    const match = content.match(MARKER_REGEX);
    if (match) {
      results.push({ section: file.name, schemas: [match[1]] });
    }
  }
  return results;
}
