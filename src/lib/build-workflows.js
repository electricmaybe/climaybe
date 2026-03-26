import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRED_PATHS = [
  { path: '_scripts/main.js', kind: 'file' },
  { path: '_styles/main.css', kind: 'file' },
];

const DEFAULTS = [
  { path: 'assets', kind: 'dir' },
];

export function getMissingBuildWorkflowRequirements(cwd = process.cwd()) {
  const missing = [];
  for (const req of REQUIRED_PATHS) {
    const abs = join(cwd, req.path);
    if (!existsSync(abs)) {
      missing.push(req);
    }
  }
  return missing;
}

export function ensureBuildWorkflowDefaults(cwd = process.cwd()) {
  for (const entry of DEFAULTS) {
    const abs = join(cwd, entry.path);
    if (existsSync(abs)) continue;
    if (entry.kind === 'dir') {
      mkdirSync(abs, { recursive: true });
      continue;
    }
    writeFileSync(abs, entry.content || '', 'utf-8');
  }
}

export function getBuildScriptRelativePath() {
  // Legacy; build-scripts are now part of climaybe runtime.
  return 'n/a';
}
