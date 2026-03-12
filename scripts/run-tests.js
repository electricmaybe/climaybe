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

// Run each test file in its own process, one after another. Command tests
// chdir() into temp dirs and use process.cwd(); parallel file execution
// caused cwd races and flaky failures in CI.
let failed = 0;
for (const file of testFiles) {
  const result = spawnSync(process.execPath, ['--test', file], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  if (result.status !== 0) failed = result.status ?? 1;
}
process.exit(failed);
