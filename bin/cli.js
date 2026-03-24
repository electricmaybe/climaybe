#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../src/index.js';
import { maybeOfferCliUpdate } from '../src/lib/update-notifier.js';

const require = createRequire(import.meta.url);
const binDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(binDir, '..');

// Prefer version baked at publish (bin/version.txt) so the running binary always reports its own version
const versionFile = join(binDir, 'version.txt');
let version;
if (existsSync(versionFile)) {
  version = readFileSync(versionFile, 'utf8').trim();
} else {
  version = require(join(packageDir, 'package.json')).version;
}

const packageName = require(join(packageDir, 'package.json')).name || 'climaybe';
await maybeOfferCliUpdate({ packageName, currentVersion: version, packageDir });
run(process.argv, version, packageDir);
