import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename, dirname, normalize } from 'node:path';

function extractImportRecords(content) {
  const imports = [];
  // Supports compact imports (import{a}from"./x"), multiline forms,
  // and import attributes (with { type: "json" }).
  const fromImportRegex =
    /(^|\n)\s*import(?:\s+type)?\s*([\s\S]*?)\s*\bfrom\b\s*['"]([^'"]+)['"](?:\s+with\s*\{[\s\S]*?\})?\s*;?/g;
  const sideEffectImportRegex = /(^|\n)\s*import\s*['"]([^'"]+)['"](?:\s+with\s*\{[\s\S]*?\})?\s*;?/g;
  let match;

  while ((match = fromImportRegex.exec(content)) !== null) {
    imports.push({ importPath: match[3], hasBindings: Boolean(match[2]?.trim()) });
  }
  while ((match = sideEffectImportRegex.exec(content)) !== null) {
    imports.push({ importPath: match[2], hasBindings: false });
  }

  return imports;
}

function extractImports(content) {
  return extractImportRecords(content).map((record) => record.importPath);
}

function stripModuleSyntax(content) {
  // Remove import statements (including multiline/compact forms and import attributes).
  let cleaned = content.replace(
    /(^|\n)\s*import(?:\s+type)?\s*[\s\S]*?\s*\bfrom\b\s*['"][^'"]+['"](?:\s+with\s*\{[\s\S]*?\})?\s*;?/g,
    '$1'
  );
  cleaned = cleaned.replace(/(^|\n)\s*import\s*['"][^'"]+['"](?:\s+with\s*\{[\s\S]*?\})?\s*;?/g, '$1');

  // Fallback: ensure no standalone import declarations leak into bundle output.
  cleaned = cleaned.replace(/^[ \t]*import\s*['"][^'"]+['"][ \t]*;?[ \t]*$/gm, '');
  cleaned = cleaned.replace(
    /^[ \t]*import(?:\s+type)?[ \t]*[^;\n\r]*\bfrom\b[ \t]*['"][^'"]+['"][ \t]*(?:with[ \t]*\{[^}\n\r]*\})?[ \t]*;?[ \t]*$/gm,
    ''
  );

  cleaned = cleaned.replace(/^\s*export\s+default\s+/gm, '');
  // Remove named exports (single-line and multiline forms).
  cleaned = cleaned.replace(/(^|\n)\s*export\s*\{[\s\S]*?\}\s*;?/g, '$1');
  cleaned = cleaned.replace(/^\s*export\s+\{[^}]*\}\s*;?\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*export\s+(?=(const|let|var|function|class)\b)/gm, '');
  return cleaned;
}

function minifyScriptContent(content) {
  let minified = content;
  // Strip block comments first so line-level processing is simpler.
  minified = minified.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip line comments and trim lines.
  minified = minified
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/g, '').trim())
    .filter(Boolean)
    .join('\n');
  // Collapse excessive whitespace around common tokens.
  minified = minified.replace(/\s*([{}();,:=+\-*/<>[\]])\s*/g, '$1');
  // Keep one space where token concatenation could break identifiers.
  minified = minified.replace(/\b(const|let|var|function|class|return|if|for|while|switch|case|new)\s+/g, '$1 ');
  return minified;
}

function processScriptFile({ scriptsDir, filePath, processedFiles, minify = false, isolateFiles = new Set() }) {
  if (processedFiles.has(filePath)) return '';
  processedFiles.add(filePath);

  const fullPath = join(scriptsDir, filePath);
  if (!existsSync(fullPath)) {
    // Keep going; missing optional imports shouldn't hard fail local dev
    // (CI will still fail later if output is invalid).
    // eslint-disable-next-line no-console
    console.warn(`Warning: File ${filePath} not found`);
    return '';
  }

  let content = readFileSync(fullPath, 'utf8');
  const imports = extractImports(content);

  let importedContent = '';
  for (const importPath of imports) {
    const resolvedImport = resolveImportPath(filePath, importPath);
    if (!resolvedImport) continue;
    importedContent += processScriptFile({
      scriptsDir,
      filePath: resolvedImport,
      processedFiles,
      minify,
      isolateFiles
    });
  }

  content = stripModuleSyntax(content);
  if (minify) content = minifyScriptContent(content);
  if (isolateFiles.has(filePath)) {
    content = `(function () {\n${content.trim()}\n})();`;
  }

  return importedContent + '\n' + content;
}

function resolveImportPath(fromFilePath, importPath) {
  // Only bundle local relative imports from _scripts.
  if (!importPath || (!importPath.startsWith('./') && !importPath.startsWith('../'))) {
    return null;
  }
  const fromDir = dirname(fromFilePath);
  const resolved = normalize(join(fromDir, importPath)).replace(/\\/g, '/');
  return resolved.startsWith('./') ? resolved.slice(2) : resolved;
}

function collectImportedFiles({ scriptsDir, entryFile, seen = new Set() }) {
  if (seen.has(entryFile)) return seen;
  seen.add(entryFile);

  const fullPath = join(scriptsDir, entryFile);
  if (!existsSync(fullPath)) return seen;
  const content = readFileSync(fullPath, 'utf8');
  const imports = extractImports(content);
  for (const importPath of imports) {
    const resolved = resolveImportPath(entryFile, importPath);
    if (!resolved) continue;
    collectImportedFiles({ scriptsDir, entryFile: resolved, seen });
  }
  return seen;
}

function collectFilesToIsolate({ scriptsDir, entryFile }) {
  const seen = new Set();
  const importedWithBindings = new Set();

  function visit(filePath) {
    if (seen.has(filePath)) return;
    seen.add(filePath);

    const fullPath = join(scriptsDir, filePath);
    if (!existsSync(fullPath)) return;
    const content = readFileSync(fullPath, 'utf8');
    const imports = extractImportRecords(content);

    for (const record of imports) {
      const resolved = resolveImportPath(filePath, record.importPath);
      if (!resolved) continue;
      if (record.hasBindings) importedWithBindings.add(resolved);
      visit(resolved);
    }
  }

  visit(entryFile);

  const isolateFiles = new Set();
  for (const file of seen) {
    if (file !== entryFile && !importedWithBindings.has(file)) {
      isolateFiles.add(file);
    }
  }

  return isolateFiles;
}

function listTopLevelEntrypoints(scriptsDir) {
  if (!existsSync(scriptsDir)) return [];
  return readdirSync(scriptsDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.js'))
    .map((d) => d.name)
    .sort();
}

function outputNameForEntrypoint(entryFile) {
  if (entryFile === 'main.js') return 'index.js';
  return basename(entryFile);
}

function buildSingleEntrypoint({ cwd, entryFile, minify = false }) {
  const scriptsDir = join(cwd, '_scripts');
  const entryPath = join(scriptsDir, entryFile);
  if (!existsSync(entryPath)) {
    throw new Error(`Missing required file: _scripts/${entryFile}`);
  }

  const processedFilesReadable = new Set();
  const processedFilesMinified = new Set();
  const isolateFiles = collectFilesToIsolate({ scriptsDir, entryFile });
  const readableContent = processScriptFile({
    scriptsDir,
    filePath: entryFile,
    processedFiles: processedFilesReadable,
    minify: false,
    isolateFiles
  });

  const minifiedContent = processScriptFile({
    scriptsDir,
    filePath: entryFile,
    processedFiles: processedFilesMinified,
    minify: true,
    isolateFiles
  });

  const assetsDir = join(cwd, 'assets');
  mkdirSync(assetsDir, { recursive: true });

  const outFile = outputNameForEntrypoint(entryFile);
  const outputPath = join(assetsDir, outFile);
  const outReadable = stripModuleSyntax(readableContent).trim() + '\n';
  const outMinified = minifyScriptContent(stripModuleSyntax(minifiedContent)).trim() + '\n';

  // When minify=true, the primary output file is minified.
  writeFileSync(outputPath, (minify ? outMinified : outReadable), 'utf-8');

  const fileCount = Math.max(processedFilesReadable.size, processedFilesMinified.size);
  return { entryFile, fileCount, outputPath };
}

export function buildScripts({ cwd = process.cwd(), entry = null, minify = false } = {}) {
  const scriptsDir = join(cwd, '_scripts');
  let entrypoints = entry ? [entry.endsWith('.js') ? entry : `${entry}.js`] : listTopLevelEntrypoints(scriptsDir);
  if (!entry && entrypoints.length > 1) {
    // Emit only root top-level scripts. If one top-level file is imported by another
    // top-level file, it is bundled into the importer and should not be emitted alone.
    const importedByTopLevel = new Set();
    for (const ep of entrypoints) {
      const imported = collectImportedFiles({ scriptsDir, entryFile: ep });
      imported.delete(ep);
      for (const file of imported) importedByTopLevel.add(file);
    }

    const rootEntrypoints = entrypoints.filter((ep) => !importedByTopLevel.has(ep));
    if (rootEntrypoints.length > 0) {
      entrypoints = rootEntrypoints;
    }
  }
  if (entrypoints.length === 0) {
    return { bundles: [] };
  }
  const bundles = entrypoints.map((entryFile) => buildSingleEntrypoint({ cwd, entryFile, minify }));
  return { bundles };
}

