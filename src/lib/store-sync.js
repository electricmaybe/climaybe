import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import pc from 'picocolors';

/**
 * Directories that participate in the root <-> stores/ sync.
 * These are the JSON-holding directories in a Shopify theme.
 */
const SYNC_DIRS = ['config', 'templates', 'sections'];

/**
 * Files explicitly excluded from sync — they travel via branch history.
 */
const EXCLUDED_FILES = [
  'config/settings_schema.json',
];

/**
 * Patterns to exclude from sync (directory-level).
 */
const EXCLUDED_DIRS = ['locales'];

/**
 * Check if a file path should be excluded from sync.
 */
function isExcluded(relativePath) {
  // Check direct file exclusions
  if (EXCLUDED_FILES.includes(relativePath)) return true;

  // Check directory exclusions
  for (const dir of EXCLUDED_DIRS) {
    if (relativePath.startsWith(dir + '/')) return true;
  }

  return false;
}

/**
 * Recursively collect all .json files in a directory.
 * Returns paths relative to the base directory.
 */
function collectJsonFiles(dir, base = dir) {
  const files = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsonFiles(full, base));
    } else if (entry.name.endsWith('.json')) {
      files.push(relative(base, full));
    }
  }

  return files;
}

/**
 * Ensure a directory exists (recursive).
 */
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Copy JSON files from stores/<alias>/ to the repo root.
 * Used by: `climaybe switch`, `stores-to-root` workflow.
 */
export function storesToRoot(alias, cwd = process.cwd()) {
  const storeDir = join(cwd, 'stores', alias);

  if (!existsSync(storeDir)) {
    console.log(pc.red(`  Store directory "stores/${alias}/" does not exist.`));
    return false;
  }

  let copied = 0;

  for (const syncDir of SYNC_DIRS) {
    const sourceDir = join(storeDir, syncDir);
    const jsonFiles = collectJsonFiles(sourceDir, storeDir);

    for (const relPath of jsonFiles) {
      if (isExcluded(relPath)) continue;

      const src = join(storeDir, relPath);
      const dest = join(cwd, relPath);

      ensureDir(join(dest, '..'));
      copyFileSync(src, dest);
      copied++;
    }
  }

  console.log(pc.green(`  Copied ${copied} file(s) from stores/${alias}/ → root`));
  return true;
}

/**
 * Copy JSON files from the repo root to stores/<alias>/.
 * Used by: `climaybe sync`, `root-to-stores` workflow.
 */
export function rootToStores(alias, cwd = process.cwd()) {
  const storeDir = join(cwd, 'stores', alias);

  let copied = 0;

  for (const syncDir of SYNC_DIRS) {
    const sourceDir = join(cwd, syncDir);
    const jsonFiles = collectJsonFiles(sourceDir, cwd);

    for (const relPath of jsonFiles) {
      if (isExcluded(relPath)) continue;

      const src = join(cwd, relPath);
      const dest = join(storeDir, relPath);

      ensureDir(join(dest, '..'));
      copyFileSync(src, dest);
      copied++;
    }
  }

  console.log(pc.green(`  Copied ${copied} file(s) from root → stores/${alias}/`));
  return true;
}

/**
 * Create the store directory structure for a new store.
 */
export function createStoreDirectories(alias, cwd = process.cwd()) {
  const storeDir = join(cwd, 'stores', alias);

  for (const dir of SYNC_DIRS) {
    const target = join(storeDir, dir);
    ensureDir(target);
  }

  console.log(pc.green(`  Created store directory: stores/${alias}/`));
}
