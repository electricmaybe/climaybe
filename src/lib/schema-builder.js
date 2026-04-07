import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SCHEMA_DIR = '_schemas';
const LIQUID_DIRS = ['sections', 'blocks'];

// Matches the inline-comment marker: {% # schema 'name' %}
const MARKER_REGEX =
  /\{%-?\s*#\s*schema\s+['"]([^'"]+)['"]\s*-?%\}/;

// Matches the marker, then an optional inline-override marker, then an
// optional existing generated {% schema %}...{% endschema %} block, all the
// way to end-of-file.
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
 * Process a single directory of liquid files (sections/ or blocks/).
 */
function processLiquidDir({ dirPath, dirName, schemasDir, dryRun, processed, skipped, errors }) {
  if (!existsSync(dirPath)) return;

  const files = readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.liquid'))
    .map((d) => d.name)
    .sort();

  for (const fileName of files) {
    const filePath = join(dirPath, fileName);
    const displayName = `${dirName}/${fileName}`;
    const content = readFileSync(filePath, 'utf-8');

    if (!MARKER_REGEX.test(content)) {
      skipped.push(displayName);
      continue;
    }

    if (!existsSync(schemasDir)) {
      errors.push({
        section: displayName,
        schema: '(unknown)',
        error: '_schemas/ directory not found',
      });
      continue;
    }

    const fullMatch = content.match(MARKER_WITH_OUTPUT_REGEX);
    if (!fullMatch) {
      skipped.push(displayName);
      continue;
    }

    const marker = fullMatch[1];
    const schemaName = fullMatch[2];
    const betweenContent = fullMatch[3] || '';

    const schemaFile = resolveSchemaFile(schemasDir, schemaName);
    if (!schemaFile) {
      errors.push({
        section: displayName,
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

      const schema = evaluateSchema(schemaExport, fileName, inlineContent);
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
        writeFileSync(filePath, newContent, 'utf-8');
      }
      processed.push({ section: displayName, schemaName });
    } catch (err) {
      errors.push({
        section: displayName,
        schema: schemaName,
        error: err.message,
      });
    }
  }
}

/**
 * Build section and block schemas for a Shopify theme project.
 *
 * Scans `sections/*.liquid` and `blocks/*.liquid` for an inline-comment marker:
 *
 *   {% # schema 'hero-banner' %}
 *
 * When found, resolves `_schemas/hero-banner.js` (or `.json`), evaluates it,
 * and writes (or replaces) the generated `{% schema %}...{% endschema %}`
 * block directly below the marker. The marker is never removed, so rebuilds
 * always work — even after Shopify theme editor edits.
 *
 * @param {object}  options
 * @param {string}  [options.cwd]    Theme project root (default `process.cwd()`).
 * @param {boolean} [options.dryRun] When true, compute schemas without writing files.
 * @returns {{ processed: Array<{section: string, schemaName: string}>, skipped: string[], errors: Array<{section: string, schema: string, error: string}> }}
 */
export function buildSchemas({ cwd = process.cwd(), dryRun = false } = {}) {
  const schemasDir = join(cwd, SCHEMA_DIR);

  const processed = [];
  const skipped = [];
  const errors = [];

  for (const dirName of LIQUID_DIRS) {
    processLiquidDir({
      dirPath: join(cwd, dirName),
      dirName,
      schemasDir,
      dryRun,
      processed,
      skipped,
      errors,
    });
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
 * List liquid files in sections/ and blocks/ that contain the inline-comment schema marker.
 */
export function listSectionsWithSchemaRefs(cwd = process.cwd()) {
  const results = [];

  for (const dirName of LIQUID_DIRS) {
    const dirPath = join(cwd, dirName);
    if (!existsSync(dirPath)) continue;

    const files = readdirSync(dirPath, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.liquid'));

    for (const file of files) {
      const content = readFileSync(join(dirPath, file.name), 'utf-8');
      const match = content.match(MARKER_REGEX);
      if (match) {
        results.push({ section: `${dirName}/${file.name}`, schemas: [match[1]] });
      }
    }
  }

  return results;
}
