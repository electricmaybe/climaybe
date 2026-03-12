import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TESTS_DIR = join(process.cwd(), 'tests');

function findTestFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      findTestFiles(full, files);
    } else if (name.endsWith('.test.js')) {
      files.push(full);
    }
  }
  return files;
}

const testFiles = findTestFiles(TESTS_DIR);
if (testFiles.length === 0) {
  console.error('No *.test.js files found under tests/');
  process.exit(1);
}

// Run test files serially on Node 20+ to avoid process.cwd() races between
// command tests that chdir into temp dirs. (--test-concurrency added in Node 20.)
const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
const args = ['--test', ...(nodeMajor >= 20 ? ['--test-concurrency=1'] : []), ...testFiles];
const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  cwd: process.cwd(),
});
process.exit(result.status ?? 1);
