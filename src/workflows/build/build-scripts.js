const fs = require('fs');
const path = require('path');
const CLIMAYBE_DIR = process.cwd();
const SCRIPTS_DIR = path.join(CLIMAYBE_DIR, '_scripts');

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

function processScriptFile(filePath, processedFiles = new Set()) {
  if (processedFiles.has(filePath)) {
    return '';
  }

  processedFiles.add(filePath);

  const fullPath = path.join(SCRIPTS_DIR, filePath);

  if (!fs.existsSync(fullPath)) {
    console.warn(`Warning: File ${filePath} not found`);
    return '';
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const imports = extractImports(content);

  let importedContent = '';
  for (const importPath of imports) {
    importedContent += processScriptFile(importPath, processedFiles);
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

function buildScripts() {
  try {
    if (global.gc) global.gc();

    const mainPath = path.join(SCRIPTS_DIR, 'main.js');
    fs.readFileSync(mainPath, 'utf8');

    const processedFiles = new Set();
    let finalContent = processScriptFile('main.js', processedFiles);
    finalContent = stripModuleSyntax(finalContent);
    const outputPath = path.join(CLIMAYBE_DIR, 'assets', 'index.js');
    fs.writeFileSync(outputPath, finalContent.trim() + '\n');

    const fileCount = processedFiles.size;
    console.log(`✅ Scripts built (${fileCount} files)`);
    processedFiles.clear();
    if (global.gc) global.gc();
  } catch (error) {
    console.error('❌ Build error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  buildScripts();
}

module.exports = { buildScripts };