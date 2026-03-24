import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolve the version shown by the CLI.
 * - In dev checkouts (e.g. npm link), prefer package.json.
 * - In packaged installs, prefer bin/version.txt and fallback to package.json.
 */
export function resolveCliVersion({ packageDir, binDir, packageVersion }) {
  const devCheckout = existsSync(join(packageDir, '.git'));
  if (devCheckout) return packageVersion;

  const versionFile = join(binDir, 'version.txt');
  if (existsSync(versionFile)) {
    const baked = readFileSync(versionFile, 'utf8').trim();
    if (baked) return baked;
  }

  return packageVersion;
}
