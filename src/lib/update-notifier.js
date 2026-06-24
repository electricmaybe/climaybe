import { execSync } from 'node:child_process';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pc from 'picocolors';

const NPM_REGISTRY_BASE = 'https://registry.npmjs.org';
const DEFAULT_TIMEOUT_MS = 1200;

function parseSemver(version) {
  const match = String(version || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isVersionGreater(candidate, current) {
  const a = parseSemver(candidate);
  const b = parseSemver(current);
  if (!a || !b) return false;
  if (a[0] !== b[0]) return a[0] > b[0];
  if (a[1] !== b[1]) return a[1] > b[1];
  return a[2] > b[2];
}

async function fetchLatestVersion(packageName, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${NPM_REGISTRY_BASE}/${encodeURIComponent(packageName)}/latest`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    const json = await response.json();
    return typeof json.version === 'string' ? json.version : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function canPromptForUpdate() {
  return Boolean(input.isTTY && output.isTTY && process.env.CI !== 'true');
}

function isNodeModulesInstall(packageDir, packageName) {
  if (!packageDir || !packageName) return false;
  const normalized = resolve(packageDir);
  const nm = `${join('node_modules', packageName)}`;
  return normalized.includes(`${join('node_modules', '')}`) && normalized.endsWith(nm);
}

export function resolveInstallScope({ packageName, packageDir, cwd = process.cwd() } = {}) {
  // Prefer using the *running* CLI install path to decide how to update.
  // This prevents "update loops" where we update a project dependency while the
  // user is actually running a global install (or vice-versa).
  if (isNodeModulesInstall(packageDir, packageName)) return 'local';

  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    if (packageDir && resolve(packageDir).startsWith(resolve(globalRoot))) return 'global';
  } catch {
    // ignore and fallback to local checks
  }

  // If we don't have an install path, fall back to "am I in a project?"
  if (!packageDir && existsSync(join(cwd, 'package.json'))) return 'local';
  return 'global';
}

export function getLocalInstallFlag({ packageName, cwd = process.cwd() } = {}) {
  // Always keep climaybe in runtime dependencies for theme repos.
  if (packageName === 'climaybe') return '--save';
  try {
    const pkgPath = join(cwd, 'package.json');
    if (!existsSync(pkgPath)) return '--save-dev';
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    if (pkg?.dependencies?.[packageName]) return '--save';
    if (pkg?.devDependencies?.[packageName]) return '--save-dev';
    return '--save-dev';
  } catch {
    return '--save-dev';
  }
}

function runUpdate(packageName, { packageDir, cwd = process.cwd() } = {}) {
  const scope = resolveInstallScope({ packageName, packageDir, cwd });
  if (scope === 'global') {
    execSync(`npm install -g ${packageName}@latest`, { stdio: 'inherit' });
    return 'global';
  }
  const installCwd = cwd || process.cwd();
  const flag = getLocalInstallFlag({ packageName, cwd: installCwd });
  execSync(`npm install ${packageName}@latest ${flag}`, { cwd: installCwd, stdio: 'inherit' });
  return 'local';
}

export async function maybeOfferCliUpdate({
  packageName,
  currentVersion,
  packageDir,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!packageName || !currentVersion || !canPromptForUpdate()) return;
  const invocationCwd = process.cwd();

  const latestVersion = await fetchLatestVersion(packageName, timeoutMs);
  if (!latestVersion || !isVersionGreater(latestVersion, currentVersion)) return;

  console.log(pc.yellow(`\nA newer ${packageName} is available: ${currentVersion} -> ${latestVersion}`));
  console.log(pc.dim('Press Enter to update now, or type "n" to continue without updating.'));

  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question('Update now? [Y/n] ')).trim().toLowerCase();
    const shouldUpdate = answer === '' || answer === 'y' || answer === 'yes';
    if (!shouldUpdate) return;

    try {
      const updatedScope = runUpdate(packageName, { packageDir, cwd: process.cwd() });
      console.log(pc.green(`Updated ${packageName} (${updatedScope}) to latest. Restarting command...`));
      // Continue in the repo where the user invoked the command.
      process.chdir(invocationCwd);
    } catch (err) {
      console.log(pc.red('Update failed. Continuing with current version.'));
      if (err?.message) console.log(pc.dim(err.message));
    }
  } finally {
    rl.close();
  }
}
