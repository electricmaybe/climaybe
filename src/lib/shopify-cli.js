import { spawn } from 'node:child_process';
import pc from 'picocolors';

function spawnInherit(cmd, args, { cwd = process.cwd(), name = cmd } = {}) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.log(pc.red(`\n  ${name} exited with code ${code}\n`));
    }
  });
  return child;
}

/**
 * Run Shopify CLI, falling back to npx when `shopify` isn't available.
 * @param {string[]} args e.g. ['theme','check']
 */
export function runShopify(args, { cwd = process.cwd(), name = 'shopify' } = {}) {
  const child = spawnInherit('shopify', args, { cwd, name });
  child.on('error', (err) => {
    if (err?.code !== 'ENOENT') return;
    spawnInherit('npx', ['-y', '@shopify/cli@latest', ...args], { cwd, name: 'shopify(npx)' });
  });
  return child;
}

