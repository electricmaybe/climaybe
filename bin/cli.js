#!/usr/bin/env node

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../src/index.js';

// Resolve version from package.json next to this bin (works with npm link / global install)
const require = createRequire(import.meta.url);
const binDir = dirname(fileURLToPath(import.meta.url));
const pkg = require(join(binDir, '..', 'package.json'));

run(process.argv, pkg.version);
