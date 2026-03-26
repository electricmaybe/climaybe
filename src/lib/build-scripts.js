import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename, dirname, normalize } from 'node:path';

function extractImports(content) {
  const imports = [];
  // Supports compact imports (import{a}from"./x"), multiline forms,
  // and import attributes (with { type: "json" }).
  const fromImportRegex =
    /(^|\n)\s*import(?:\s+type)?\s*[\s\S]*?\s*\bfrom\b\s*['"]([^'"]+)['"](?:\s+with\s*\{[\s\S]*?\})?\s*;?/g;
  const sideEffectImportRegex = /(^|\n)\s*import\s*['"]([^'"]+)['"](?:\s+with\s*\{[\s\S]*?\})?\s*;?/g;
  let match;

  while ((match = fromImportRegex.exec(content)) !== null) {
    imports.push(match[2]);
  }
  while ((match = sideEffectImportRegex.exec(content)) !== null) {
    imports.push(match[2]);
  }

  return imports;
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
  cleaned = cleaned.replace(/^\s*export\s+\{[^}]*\}\s*;?\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*export\s+(?=(const|let|var|function|class)\b)/gm, '');
  return cleaned;
}

function processScriptFile({ scriptsDir, filePath, processedFiles }) {
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
    importedContent += processScriptFile({ scriptsDir, filePath: resolvedImport, processedFiles });
  }

  content = stripModuleSyntax(content);

  if (process.env.NODE_ENV === 'production') {
    content = content.replace(/\/\*\*[\s\S]*?\*\//g, '');
    content = content.replace(/^\s*\*.*$/gm, '');
    content = content.replace(/console\.(log|warn|error)\([^)]*\);?\s*/g, '');
    content = content.replace(/^\s*\n/gm, '');
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

function buildSingleEntrypoint({ cwd, entryFile }) {
  const scriptsDir = join(cwd, '_scripts');
  const entryPath = join(scriptsDir, entryFile);
  if (!existsSync(entryPath)) {
    throw new Error(`Missing required file: _scripts/${entryFile}`);
  }

  const processedFiles = new Set();
  let finalContent = processScriptFile({ scriptsDir, filePath: entryFile, processedFiles });
  finalContent = stripModuleSyntax(finalContent);

  const assetsDir = join(cwd, 'assets');
  mkdirSync(assetsDir, { recursive: true });

  const outFile = outputNameForEntrypoint(entryFile);
  const outputPath = join(assetsDir, outFile);
  writeFileSync(outputPath, finalContent.trim() + '\n', 'utf-8');

  return { entryFile, fileCount: processedFiles.size, outputPath };
}

export function buildScripts({ cwd = process.cwd(), entry = null } = {}) {
  const scriptsDir = join(cwd, '_scripts');
  let entrypoints = entry ? [entry.endsWith('.js') ? entry : `${entry}.js`] : listTopLevelEntrypoints(scriptsDir);
  if (!entry && entrypoints.includes('main.js')) {
    const importedByMain = collectImportedFiles({ scriptsDir, entryFile: 'main.js' });
    importedByMain.delete('main.js');
    entrypoints = entrypoints.filter((ep) => ep === 'main.js' || !importedByMain.has(ep));
  }
  if (entrypoints.length === 0) {
    return { bundles: [] };
  }
  const bundles = entrypoints.map((entryFile) => buildSingleEntrypoint({ cwd, entryFile }));
  return { bundles };
}

