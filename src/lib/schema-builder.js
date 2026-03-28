import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve as pathResolve } from 'node:path';

const SCHEMA_DIR = '_schemas';

const SCHEMA_REF_REGEX =
  /\{%-?\s*schema\s+['"]([^'"]+)['"]\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/g;

/**
 * Resolve a schema source file (.js or .json) from the schemas directory.
 * Returns the absolute path or null when not found.
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
 * `.json` files are parsed directly. Each load busts the require cache so
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
 * Parse optional inline JSON between the schema tags.
 * Returns an empty object when the content is blank or invalid.
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
 *   the schema object — this covers the "section-specific overrides" pattern
 *   from the blog article.
 * - **Object exports** are merged with any inline content (inline wins) so
 *   individual sections can override fields like `name`.
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
 * Scans `sections/*.liquid` for `{% schema 'name' %}` directives, resolves
 * the referenced JS/JSON file from `_schemas/`, evaluates it (supporting
 * shared partials, looping helpers, function exports, and inline overrides),
 * then injects the resulting JSON into the section file.
 *
 * @param {object}  options
 * @param {string}  [options.cwd]    Theme project root (default `process.cwd()`).
 * @param {boolean} [options.dryRun] When true, compute schemas without writing files.
 * @returns {{ processed: Array<{section: string, schema: string}>, skipped: string[], errors: Array<{section: string, schema: string, error: string}> }}
 */
export function buildSchemas({ cwd = process.cwd(), dryRun = false } = {}) {
  const schemasDir = join(cwd, SCHEMA_DIR);
  const sectionsDir = join(cwd, 'sections');

  if (!existsSync(schemasDir)) {
    return { processed: [], skipped: [], errors: [] };
  }
  if (!existsSync(sectionsDir)) {
    return { processed: [], skipped: [], errors: [] };
  }

  const sectionFiles = readdirSync(sectionsDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.liquid'))
    .map((d) => d.name)
    .sort();

  const processed = [];
  const skipped = [];
  const errors = [];

  for (const sectionFile of sectionFiles) {
    const sectionPath = join(sectionsDir, sectionFile);
    const original = readFileSync(sectionPath, 'utf-8');
    let content = original;
    let touched = false;

    content = content.replace(SCHEMA_REF_REGEX, (_match, schemaName, inlineJson) => {
      const schemaFile = resolveSchemaFile(schemasDir, schemaName);
      if (!schemaFile) {
        errors.push({
          section: sectionFile,
          schema: schemaName,
          error: `Schema file not found: _schemas/${schemaName}.js or .json`,
        });
        return _match;
      }

      try {
        const schemaExport = loadSchemaModule(schemasDir, schemaFile);
        const inlineContent = parseInlineContent(inlineJson);
        const schema = evaluateSchema(schemaExport, sectionFile, inlineContent);
        const json = JSON.stringify(schema, null, 2);
        touched = true;
        return `{% schema %}\n${json}\n{% endschema %}`;
      } catch (err) {
        errors.push({
          section: sectionFile,
          schema: schemaName,
          error: err.message,
        });
        return _match;
      }
    });

    if (touched) {
      if (!dryRun) {
        writeFileSync(sectionPath, content, 'utf-8');
      }
      processed.push({ section: sectionFile, schema: content });
    } else if (!errors.some((e) => e.section === sectionFile)) {
      skipped.push(sectionFile);
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
 * List section files that contain schema references (`{% schema 'name' %}`).
 */
export function listSectionsWithSchemaRefs(cwd = process.cwd()) {
  const sectionsDir = join(cwd, 'sections');
  if (!existsSync(sectionsDir)) return [];

  const results = [];
  const files = readdirSync(sectionsDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.liquid'));

  for (const file of files) {
    const content = readFileSync(join(sectionsDir, file.name), 'utf-8');
    const refs = [];
    let m;
    const re = new RegExp(SCHEMA_REF_REGEX.source, SCHEMA_REF_REGEX.flags);
    while ((m = re.exec(content)) !== null) {
      refs.push(m[1]);
    }
    if (refs.length > 0) {
      results.push({ section: file.name, schemas: refs });
    }
  }
  return results;
}
