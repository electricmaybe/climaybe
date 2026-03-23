import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { readPkg, writePkg } from './config.js';

const COMMITLINT_DEPS = {
  '@commitlint/cli': '^20.4.4',
  '@commitlint/config-conventional': '^20.4.4',
  husky: '^9.1.7',
};

const COMMITLINT_CONFIG = `/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  defaultIgnores: true,
  ignores: [(commit) => /^Merge\\s/i.test((commit || '').split('\\n')[0] || '')],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore'],
    ],
    'subject-empty': [0],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 200],
  },
};
`;

const HUSKY_COMMIT_MSG = `# Ensure npx is on PATH when Git/IDE run with a minimal env (e.g. Cursor, VS Code)
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
npx --no-install commitlint --edit "$1"
`;

/**
 * Scaffold commitlint config, Husky commit-msg hook, and add deps to package.json.
 * Runs npm install so husky prepare runs and hooks are installed (unless options.skipInstall).
 * @param {string} [cwd] - Working directory (default process.cwd())
 * @param {{ skipInstall?: boolean }} [options] - skipInstall: true to skip npm install (e.g. in tests)
 * @returns {boolean} - true if scaffolded, false if skipped/failed
 */
export function scaffoldCommitlint(cwd = process.cwd(), options = {}) {
  const pkg = readPkg(cwd);
  if (!pkg) return false;

  const updated = { ...pkg };
  updated.scripts = { ...pkg.scripts };
  if (!updated.scripts.prepare) {
    updated.scripts.prepare = 'husky';
  } else if (!updated.scripts.prepare.includes('husky')) {
    updated.scripts.prepare = `husky && ${updated.scripts.prepare}`;
  }
  updated.devDependencies = { ...pkg.devDependencies, ...COMMITLINT_DEPS };
  writePkg(updated, cwd);

  writeFileSync(join(cwd, 'commitlint.config.js'), COMMITLINT_CONFIG, 'utf-8');

  const huskyDir = join(cwd, '.husky');
  if (!existsSync(huskyDir)) {
    mkdirSync(huskyDir, { recursive: true });
  }
  writeFileSync(join(huskyDir, 'commit-msg'), HUSKY_COMMIT_MSG, 'utf-8');

  if (options.skipInstall) return true;
  try {
    execSync('npm install', { cwd, stdio: 'inherit' });
  } catch {
    return false;
  }
  return true;
}
