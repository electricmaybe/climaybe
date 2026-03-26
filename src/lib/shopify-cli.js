import { spawn } from 'node:child_process';
import pc from 'picocolors';

function spawnShopify(
  cmd,
  args,
  { cwd = process.cwd(), name = cmd, stdio = 'inherit', onStdout, onStderr } = {}
) {
  const child = spawn(cmd, args, {
    cwd,
    stdio,
    shell: process.platform === 'win32',
  });
  if (stdio === 'pipe') {
    if (child.stdout && onStdout) child.stdout.on('data', (buf) => onStdout(String(buf)));
    if (child.stderr && onStderr) child.stderr.on('data', (buf) => onStderr(String(buf)));
  }
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.log(pc.red(`\n  [${name}] exited with code ${code}\n`));
    }
  });
  return child;
}

/**
 * Run Shopify CLI, falling back to npx when `shopify` isn't available.
 * @param {string[]} args e.g. ['theme','check']
 */
export function runShopify(args, { cwd = process.cwd(), name = 'shopify', stdio = 'inherit', onStdout, onStderr } = {}) {
  const child = spawnShopify('shopify', args, { cwd, name, stdio, onStdout, onStderr });
  child.on('error', (err) => {
    if (err?.code !== 'ENOENT') return;
    spawnShopify('npx', ['-y', '@shopify/cli@latest', ...args], {
      cwd,
      name: 'shopify(npx)',
      stdio,
      onStdout,
      onStderr,
    });
  });
  return child;
}

