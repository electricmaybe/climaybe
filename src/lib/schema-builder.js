import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SCHEMA_DIR = '_schemas';
const SECTIONS_SRC_DIR = '_sections';
const SECTIONS_OUT_DIR = 'sections';

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
 *   the schema object — this covers the "section-specific overrides" pattern.
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
 * Source files live in `_sections/*.liquid` (never shipped to Shopify).
 * Schema definitions live in `_schemas/` as JS or JSON files.
 *
 * The builder reads each `_sections/*.liquid` file, resolves any
 * `{% schema 'name' %}...{% endschema %}` references against `_schemas/`,
 * injects the resulting JSON, and writes the output to `sections/` — the
 * folder Shopify actually reads. The source tag in `_sections/` is preserved
 * so the build is always repeatable.
 *
 * Sections without schema references are copied verbatim to `sections/`.
 *
 * @param {object}  options
 * @param {string}  [options.cwd]    Theme project root (default `process.cwd()`).
 * @param {boolean} [options.dryRun] When true, compute schemas without writing files.
 * @returns {{ processed: Array<{section: string, schema: string}>, copied: string[], errors: Array<{section: string, schema: string, error: string}> }}
 */
export function buildSchemas({ cwd = process.cwd(), dryRun = false } = {}) {
  const schemasDir = join(cwd, SCHEMA_DIR);
  const srcDir = join(cwd, SECTIONS_SRC_DIR);
  const outDir = join(cwd, SECTIONS_OUT_DIR);

  if (!existsSync(srcDir)) {
    return { processed: [], copied: [], errors: [] };
  }

  const sectionFiles = readdirSync(srcDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.liquid'))
    .map((d) => d.name)
    .sort();

  if (sectionFiles.length === 0) {
    return { processed: [], copied: [], errors: [] };
  }

  if (!dryRun) {
    mkdirSync(outDir, { recursive: true });
  }

  const processed = [];
  const copied = [];
  const errors = [];

  for (const sectionFile of sectionFiles) {
    const srcPath = join(srcDir, sectionFile);
    const outPath = join(outDir, sectionFile);
    const source = readFileSync(srcPath, 'utf-8');

    const re = new RegExp(SCHEMA_REF_REGEX.source, SCHEMA_REF_REGEX.flags);
    const hasRef = re.test(source);

    if (!hasRef) {
      if (!dryRun) {
        writeFileSync(outPath, source, 'utf-8');
      }
      copied.push(sectionFile);
      continue;
    }

    if (!existsSync(schemasDir)) {
      errors.push({
        section: sectionFile,
        schema: '(unknown)',
        error: '_schemas/ directory not found — cannot resolve schema references',
      });
      continue;
    }

    let output = source;
    let hasError = false;

    output = output.replace(SCHEMA_REF_REGEX, (_match, schemaName, inlineJson) => {
      const schemaFile = resolveSchemaFile(schemasDir, schemaName);
      if (!schemaFile) {
        errors.push({
          section: sectionFile,
          schema: schemaName,
          error: `Schema file not found: _schemas/${schemaName}.js or .json`,
        });
        hasError = true;
        return _match;
      }

      try {
        const schemaExport = loadSchemaModule(schemasDir, schemaFile);
        const inlineContent = parseInlineContent(inlineJson);
        const schema = evaluateSchema(schemaExport, sectionFile, inlineContent);
        const json = JSON.stringify(schema, null, 2);
        return `{% schema %}\n${json}\n{% endschema %}`;
      } catch (err) {
        errors.push({
          section: sectionFile,
          schema: schemaName,
          error: err.message,
        });
        hasError = true;
        return _match;
      }
    });

    if (!hasError) {
      if (!dryRun) {
        writeFileSync(outPath, output, 'utf-8');
      }
      processed.push({ section: sectionFile, schema: output });
    }
  }

  return { processed, copied, errors };
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
 * List source section files in `_sections/` that contain schema references.
 */
export function listSectionsWithSchemaRefs(cwd = process.cwd()) {
  const srcDir = join(cwd, SECTIONS_SRC_DIR);
  if (!existsSync(srcDir)) return [];

  const results = [];
  const files = readdirSync(srcDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.liquid'));

  for (const file of files) {
    const content = readFileSync(join(srcDir, file.name), 'utf-8');
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
