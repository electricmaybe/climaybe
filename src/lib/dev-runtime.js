import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { watchTree } from './watch.js';
import { join } from 'node:path';
import pc from 'picocolors';
import { readConfig } from './config.js';
import { buildScripts } from './build-scripts.js';
import { runShopify } from './shopify-cli.js';

function getPackageDir() {
  return process.env.CLIMAYBE_PACKAGE_DIR || process.cwd();
}

function binPath(binName) {
  // Resolve to this package's bundled .bin (works for npx + installed package).
  return join(getPackageDir(), 'node_modules', '.bin', binName);
}

function spawnLogged(command, args, { name, cwd = process.cwd(), env = process.env } = {}) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(pc.yellow(`\n  ${name} exited with signal ${signal}\n`));
      return;
    }
    if (code && code !== 0) {
      console.log(pc.red(`\n  ${name} exited with code ${code}\n`));
    }
  });

  return child;
}

function runTailwind(args, { cwd = process.cwd(), env = process.env, name = 'tailwind' } = {}) {
  return spawnLogged(
    'npx',
    ['-y', '--package', '@tailwindcss/cli@latest', '--package', 'tailwindcss@latest', 'tailwindcss', ...args],
    { name, cwd, env }
  );
}

function safeClose(w) {
  if (!w) return;
  try {
    w.close?.();
  } catch {
    // ignore
  }
}

function safeKill(child) {
  if (!child || typeof child.kill !== 'function') return;
  try {
    child.kill('SIGTERM');
  } catch {
    // ignore
  }
}

export function serveShopify({ cwd = process.cwd() } = {}) {
  const config = readConfig(cwd) || {};
  const store = config.default_store || config.store || '';
  const args = ['theme', 'dev', '--theme-editor-sync'];
  if (store) args.push(`--store=${store}`);
  return runShopify(args, { cwd, name: 'shopify' });
}

export function serveAssets({ cwd = process.cwd(), includeThemeCheck = true } = {}) {
  const env = { ...process.env, NODE_ENV: 'production' };
  const styleEntrypoint = join(cwd, '_styles', 'main.css');
  const tailwind = existsSync(styleEntrypoint)
    ? runTailwind(['-i', '_styles/main.css', '-o', 'assets/style.css', '--watch'], { cwd, env, name: 'tailwind' })
    : null;

  // Optional dev MCP (non-blocking if missing)
  const devMcp = spawnLogged('npx', ['-y', '@shopify/dev-mcp@latest'], { name: 'dev-mcp', cwd });

  const scriptsDir = join(cwd, '_scripts');
  if (existsSync(scriptsDir)) {
    try {
      buildScripts({ cwd });
      console.log(pc.green('  scripts built (initial)'));
    } catch (err) {
      console.log(pc.red(`  initial scripts build failed: ${err.message}`));
    }
  }
  const scriptsWatch = existsSync(scriptsDir)
    ? watchTree({
        rootDir: scriptsDir,
        ignore: (p) => p.includes('node_modules') || p.includes('/assets/') || p.includes('/.git/'),
        debounceMs: 300,
        onChange: () => {
          try {
            buildScripts({ cwd });
            console.log(pc.green('  scripts rebuilt'));
          } catch (err) {
            console.log(pc.red(`  scripts build failed: ${err.message}`));
          }
        },
      })
    : null;

  const themeCheckWatch =
    includeThemeCheck
      ? watchTree({
          rootDir: cwd,
          ignore: (p) =>
            p.includes('/node_modules/') ||
            p.includes('/assets/') ||
            p.includes('/.git/') ||
            p.includes('/_scripts/') ||
            p.includes('/_styles/'),
          debounceMs: 800,
          onChange: () => {
            runShopify(['theme', 'check'], { cwd, name: 'theme-check' });
          },
        })
      : null;

  const cleanup = () => {
    safeClose(scriptsWatch);
    safeClose(themeCheckWatch);
    safeKill(tailwind);
    safeKill(devMcp);
  };

  return { tailwind, devMcp, scriptsWatch, themeCheckWatch, cleanup };
}

export function serveAll({ cwd = process.cwd(), includeThemeCheck = true } = {}) {
  // Keep Shopify CLI in the foreground (real TTY), and run watchers in background.
  const assets = serveAssets({ cwd, includeThemeCheck });
  const shopify = serveShopify({ cwd });

  const cleanup = () => {
    assets.cleanup?.();
    safeKill(shopify);
  };

  const handleSignal = () => cleanup();
  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);

  shopify.on('exit', () => {
    cleanup();
  });

  return { shopify, ...assets, cleanup };
}

export function lintAll({ cwd = process.cwd() } = {}) {
  // Keep these intentionally simple wrappers; users can run the underlying tools directly if desired.
  const eslint = spawnLogged(binPath('eslint'), ['./assets/*.js', '--config', '.config/eslint.config.mjs'], {
    name: 'eslint',
    cwd,
  });
  const stylelint = spawnLogged(
    binPath('stylelint'),
    ['./assets/*.css', '--config', '.config/.stylelintrc.json'],
    { name: 'stylelint', cwd }
  );
  const themeCheck = runShopify(['theme', 'check'], { cwd, name: 'theme-check' });
  return { eslint, stylelint, themeCheck };
}

export function buildAll({ cwd = process.cwd() } = {}) {
  const env = { ...process.env, NODE_ENV: 'production' };
  let scriptsOk = true;
  try {
    buildScripts({ cwd });
  } catch (err) {
    console.log(pc.red(`\n  build-scripts failed: ${err.message}\n`));
    scriptsOk = false;
  }
  const tailwind = runTailwind(['-i', '_styles/main.css', '-o', 'assets/style.css', '--minify'], {
    cwd,
    env,
    name: 'tailwind',
  });
  return { scriptsOk, tailwind };
}

