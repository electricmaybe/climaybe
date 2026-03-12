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

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  cwd: process.cwd(),
});
process.exit(result.status ?? 1);
