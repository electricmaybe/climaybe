#!/usr/bin/env node

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../src/index.js';
import { resolveCliVersion } from '../src/lib/cli-version.js';
import { maybeOfferCliUpdate } from '../src/lib/update-notifier.js';

const require = createRequire(import.meta.url);
const binDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(binDir, '..');

const pkg = require(join(packageDir, 'package.json'));
const version = resolveCliVersion({
  packageDir,
  binDir,
  packageVersion: pkg.version,
});
const packageName = pkg.name || 'climaybe';
await maybeOfferCliUpdate({ packageName, currentVersion: version, packageDir });
run(process.argv, version, packageDir);
