const fs = require('fs');
const path = require('path');
const ROOT_DIR = process.cwd();

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

function processScriptFile(filePath, processedFiles = new Set()) {
  if (processedFiles.has(filePath)) {
    return '';
  }

  processedFiles.add(filePath);

  const fullPath = path.join(ROOT_DIR, '_scripts', filePath);

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

  // Remove import statements (including multiline/compact forms and import attributes).
  content = content.replace(
    /(^|\n)\s*import(?:\s+type)?\s*[\s\S]*?\s*\bfrom\b\s*['"][^'"]+['"](?:\s+with\s*\{[\s\S]*?\})?\s*;?/g,
    '$1'
  );
  content = content.replace(/(^|\n)\s*import\s*['"][^'"]+['"](?:\s+with\s*\{[\s\S]*?\})?\s*;?/g, '$1');
  content = content.replace(/^\s*export\s+default\s+/gm, '');
  content = content.replace(/^\s*export\s+\{[^}]*\}\s*;?\s*$/gm, '');
  content = content.replace(/^\s*export\s+(?=(const|let|var|function|class)\b)/gm, '');

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

    const mainPath = path.join(ROOT_DIR, '_scripts', 'main.js');
    fs.readFileSync(mainPath, 'utf8');

    const processedFiles = new Set();
    const finalContent = processScriptFile('main.js', processedFiles);
    const outputPath = path.join(ROOT_DIR, 'assets', 'index.js');
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