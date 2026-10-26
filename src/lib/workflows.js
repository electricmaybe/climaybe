import { existsSync, mkdirSync, readdirSync, copyFileSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import { ensureBuildWorkflowDefaults } from './build-workflows.js';
import { isNightlyHotfixEnabled } from './config.js';
import { PRESERVE_CUSTOM_JOBS_FILES, mergeCustomJobs } from './workflow-custom-jobs.js';

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
  const dirs = ['shared', 'single', 'multi', 'preview', 'build', 'profile', 'linear'];
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
 * Deprecated workflow filenames to remove when scaffolding (renamed or replaced).
 * The legacy theme workflows below predate climaybe and are superseded by
 * lighthouse.yml (staging->main only), build-pipeline.yml and pr-update.yml.
 * They run on every push (e.g. aisle `Shopify Lighthouse CI`: 238 runs, 222
 * failed in 30 days) and burn billable Actions minutes.
 */
const DEPRECATED_WORKFLOW_FILES = [
  'hotfix-backport.yml',
  'lighthouse-ci.yml',
  'tailwind-build.yml',
  'scripts-build.yml',
  'theme-preview.yml',
];

/**
 * Remove previously scaffolded climaybe workflows from target.
 */
function cleanWorkflows(cwd = process.cwd()) {
  const dest = ghWorkflowsDir(cwd);
  if (!existsSync(dest)) return;

  const known = getKnownWorkflowFiles();
  for (const file of readdirSync(dest)) {
    if (known.has(file) || DEPRECATED_WORKFLOW_FILES.includes(file)) {
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
  const {
    includePreview = false,
    includeBuild = false,
    includeProfile = false,
    includeLinear = false,
    includeNightlyHotfix = isNightlyHotfixEnabled(cwd),
  } = options;
  const dest = ghWorkflowsDir(cwd);
  mkdirSync(dest, { recursive: true });

  // Remember existing workflows whose repo-specific jobs must survive regeneration.
  const previous = {};
  for (const f of PRESERVE_CUSTOM_JOBS_FILES) {
    const p = join(dest, f);
    if (existsSync(p)) previous[f] = readFileSync(p, 'utf-8');
  }

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
    // Scheduled nightly hotfix tagging is opt-in (config: nightly_hotfix: true).
    if (f === 'nightly-hotfix.yml' && !includeNightlyHotfix) continue;
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
    ensureBuildWorkflowDefaults(cwd);
  }

  if (includeProfile) {
    const profileDir = join(TEMPLATES_DIR, 'profile');
    for (const f of listYmls(profileDir)) {
      copyWorkflow(profileDir, f, dest);
    }
  }

  if (includeLinear) {
    const linearDir = join(TEMPLATES_DIR, 'linear');
    for (const f of listYmls(linearDir)) {
      copyWorkflow(linearDir, f, dest);
    }
  }

  // Re-attach repo-specific jobs (e.g. a custom unit-tests job) to regenerated workflows.
  for (const [f, old] of Object.entries(previous)) {
    const p = join(dest, f);
    if (!existsSync(p)) continue;
    const { content, preserved } = mergeCustomJobs(old, readFileSync(p, 'utf-8'));
    if (!preserved.length) continue;
    writeFileSync(p, content, 'utf-8');
    console.log(pc.dim(`  Kept custom job(s) in ${f}: ${preserved.join(', ')}`));
  }

  const total = readdirSync(dest).filter((f) => f.endsWith('.yml')).length;
  console.log(pc.green(`  Scaffolded ${total} workflow(s) → .github/workflows/`));
  console.log(pc.dim(`  Mode: ${mode}-store`));
  console.log(pc.dim(`  Preview workflows: ${includePreview ? 'enabled' : 'disabled'}`));
  console.log(pc.dim(`  Build workflows: ${includeBuild ? 'enabled' : 'disabled'}`));
  console.log(pc.dim(`  Profile workflows: ${includeProfile ? 'enabled' : 'disabled'}`));
  console.log(pc.dim(`  Nightly hotfix tag: ${includeNightlyHotfix ? 'enabled' : 'disabled'}`));
  console.log(pc.dim(`  Linear workflows: ${includeLinear ? 'enabled' : 'disabled'}`));
}
