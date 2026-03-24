import { execSync } from 'node:child_process';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
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

function runGlobalUpdate(packageName) {
  execSync(`npm install -g ${packageName}@latest`, { stdio: 'inherit' });
}

export async function maybeOfferCliUpdate({
  packageName,
  currentVersion,
  packageDir,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!packageName || !currentVersion || !canPromptForUpdate()) return;

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
      runGlobalUpdate(packageName);
      console.log(pc.green(`Updated ${packageName} to latest. Restarting command...`));
      process.chdir(packageDir || process.cwd());
    } catch (err) {
      console.log(pc.red('Update failed. Continuing with current version.'));
      if (err?.message) console.log(pc.dim(err.message));
    }
  } finally {
    rl.close();
  }
}
