import { existsSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'workflows');

/**
 * Get the path to the target repo's .github/workflows/ directory.
 */
function ghWorkflowsDir(cwd = process.cwd()) {
  return join(cwd, '.github', 'workflows');
}

/**
 * Collect all .yml files in a directory (non-recursive).
 */
function listYmls(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.yml'));
}

/**
 * Copy a single workflow template to the target repo.
 */
function copyWorkflow(srcDir, fileName, destDir) {
  const src = join(srcDir, fileName);
  const dest = join(destDir, fileName);
  copyFileSync(src, dest);
}

/**
 * Remove all climaybe-managed workflow files.
 * We prefix a comment header in each workflow so we can identify them,
 * but for simplicity we track known filenames instead.
 */
function getKnownWorkflowFiles() {
  const dirs = ['shared', 'single', 'multi', 'preview', 'build'];
  const files = new Set();
  for (const dir of dirs) {
    const dirPath = join(TEMPLATES_DIR, dir);
    for (const f of listYmls(dirPath)) {
      files.add(f);
    }
  }
  return files;
}

/**
 * Remove previously scaffolded climaybe workflows from target.
 */
function cleanWorkflows(cwd = process.cwd()) {
  const dest = ghWorkflowsDir(cwd);
  if (!existsSync(dest)) return;

  const known = getKnownWorkflowFiles();
  for (const file of readdirSync(dest)) {
    if (known.has(file)) {
      rmSync(join(dest, file));
    }
  }
}

/**
 * Scaffold the correct set of GitHub Actions workflows based on mode.
 * - Always copies shared/ workflows.
 * - Copies single/ or multi/ (+ single/) based on mode.
 */
export function scaffoldWorkflows(mode = 'single', options = {}, cwd = process.cwd()) {
  const { includePreview = false, includeBuild = false } = options;
  const dest = ghWorkflowsDir(cwd);
  mkdirSync(dest, { recursive: true });

  // Clean previously scaffolded files
  cleanWorkflows(cwd);

  // Always copy shared workflows
  const sharedDir = join(TEMPLATES_DIR, 'shared');
  for (const f of listYmls(sharedDir)) {
    copyWorkflow(sharedDir, f, dest);
  }

  // Single-store workflows (used in both modes)
  const singleDir = join(TEMPLATES_DIR, 'single');
  for (const f of listYmls(singleDir)) {
    copyWorkflow(singleDir, f, dest);
  }

  if (mode === 'multi') {
    const multiDir = join(TEMPLATES_DIR, 'multi');
    for (const f of listYmls(multiDir)) {
      copyWorkflow(multiDir, f, dest);
    }
  }

  if (includePreview) {
    const previewDir = join(TEMPLATES_DIR, 'preview');
    for (const f of listYmls(previewDir)) {
      copyWorkflow(previewDir, f, dest);
    }
  }

  if (includeBuild) {
    const buildDir = join(TEMPLATES_DIR, 'build');
    for (const f of listYmls(buildDir)) {
      copyWorkflow(buildDir, f, dest);
    }
  }

  const total = readdirSync(dest).filter((f) => f.endsWith('.yml')).length;
  console.log(pc.green(`  Scaffolded ${total} workflow(s) → .github/workflows/`));
  console.log(pc.dim(`  Mode: ${mode}-store`));
  console.log(pc.dim(`  Preview workflows: ${includePreview ? 'enabled' : 'disabled'}`));
  console.log(pc.dim(`  Build workflows: ${includeBuild ? 'enabled' : 'disabled'}`));
}
