const fs = require('fs');
const path = require('path');
const ROOT_DIR = process.cwd();

function extractImports(content) {
  const importRegex = /^\s*import\s+(?:[^'"\n;]+?\s+from\s+)?['"]([^'"]+)['"]\s*;?\s*$/gm;
  const imports = [];
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
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

  content = content.replace(/^\s*import\s+(?:[^'"\n;]+?\s+from\s+)?['"][^'"]+['"]\s*;?\s*$/gm, '');

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
