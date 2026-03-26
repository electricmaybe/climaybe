import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { watchTree } from './watch.js';
import { isAbsolute, join, relative } from 'node:path';
import pc from 'picocolors';
import { readConfig } from './config.js';
import { buildScripts } from './build-scripts.js';
import { runShopify } from './shopify-cli.js';

function tagLabel(tag, color = (s) => s) {
  return color(`[${tag}]`);
}

function writeTaggedLine(tag, color, line, stream = process.stdout) {
  const text = String(line || '').trimEnd();
  if (!text) return;
  stream.write(`${tagLabel(tag, color)} ${text}\n`);
}

function writeTaggedChunk(tag, color, chunk, stream = process.stdout) {
  for (const line of String(chunk || '').split('\n')) {
    if (!line) continue;
    writeTaggedLine(tag, color, line, stream);
  }
}

function getPackageDir() {
  return process.env.CLIMAYBE_PACKAGE_DIR || process.cwd();
}

function binPath(binName) {
  // Resolve to this package's bundled .bin (works for npx + installed package).
  return join(getPackageDir(), 'node_modules', '.bin', binName);
}

function spawnLogged(
  command,
  args,
  { name, cwd = process.cwd(), env = process.env, stdio = 'inherit', tag = null, color = (s) => s } = {}
) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio,
    shell: process.platform === 'win32',
  });
  if (stdio === 'pipe') {
    if (child.stdout) child.stdout.on('data', (buf) => writeTaggedChunk(tag || name, color, String(buf), process.stdout));
    if (child.stderr) child.stderr.on('data', (buf) => writeTaggedChunk(tag || name, color, String(buf), process.stderr));
  }

  child.on('exit', (code, signal) => {
    if (signal) {
      writeTaggedLine(tag || name, color, `exited with signal ${signal}`);
      return;
    }
    if (code && code !== 0) {
      writeTaggedLine(tag || name, color, `exited with code ${code}`, process.stderr);
    }
  });

  return child;
}

function runTailwind(args, { cwd = process.cwd(), env = process.env, name = 'tailwind' } = {}) {
  return spawnLogged(
    'npx',
    ['-y', '--package', '@tailwindcss/cli@latest', '--package', 'tailwindcss@latest', 'tailwindcss', ...args],
    { name, cwd, env, stdio: 'pipe', tag: 'tailwind', color: pc.blue }
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

function writeThemeCheckErrorsOnly(chunk, stream = process.stdout) {
  for (const line of String(chunk || '').split('\n')) {
    if (!line) continue;
    if (/warning/i.test(line)) continue;
    writeTaggedLine('theme-check', pc.red, line, stream);
  }
}

function collectThemeCheckOffenses(payload) {
  const out = [];
  const visit = (value, inheritedPath = '') => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, inheritedPath);
      return;
    }
    if (typeof value !== 'object') return;

    const localPath =
      value.path ||
      value.file ||
      value.file_path ||
      value.relative_path ||
      value.source ||
      inheritedPath ||
      '';

    if (typeof value.severity === 'string' && typeof value.message === 'string') {
      out.push({ ...value, __path: localPath || inheritedPath || '' });
      return;
    }

    if (Array.isArray(value.offenses)) {
      for (const offense of value.offenses) visit(offense, localPath || inheritedPath);
    }
    if (Array.isArray(value.checks)) {
      for (const check of value.checks) visit(check, localPath || inheritedPath);
    }

    for (const nested of Object.values(value)) visit(nested, localPath || inheritedPath);
  };
  visit(payload);
  return out;
}

function normalizeThemeCheckPath(file, cwd) {
  const raw = String(file || '').trim();
  if (!raw) return 'unknown';
  if (isAbsolute(raw)) {
    const rel = relative(cwd, raw);
    if (rel && !rel.startsWith('..')) return rel;
  }
  return raw;
}

function formatThemeCheckError(offense, { cwd = process.cwd() } = {}) {
  const file = offense.__path || offense.path || offense.file || offense.file_path || offense.relative_path || 'unknown';
  const line =
    offense.start_line ||
    offense.startLine ||
    offense.line ||
    offense.line_number ||
    offense.start_row ||
    offense.row ||
    '?';
  const check = offense.check || offense.check_name || 'theme-check';
  const message = offense.message || '';
  const safeFile = normalizeThemeCheckPath(file, cwd);
  return `${pc.cyan(safeFile)}:${pc.yellow(String(line))} ${pc.magenta(`[${check}]`)} ${pc.white(message)}`;
}

function runThemeCheckFiltered({ cwd = process.cwd() } = {}) {
  let stdout = '';
  let stderr = '';
  const child = runShopify(['theme', 'check', '--fail-level', 'error', '--output', 'json'], {
    cwd,
    name: 'theme-check',
    stdio: 'pipe',
    onStdout: (chunk) => {
      stdout += String(chunk || '');
    },
    onStderr: (chunk) => {
      stderr += String(chunk || '');
    },
  });
  child.on('exit', () => {
    const trimmed = stdout.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        const offenses = collectThemeCheckOffenses(parsed).filter(
          (offense) => String(offense.severity || '').toLowerCase() === 'error'
        );
        const seen = new Set();
        for (const offense of offenses) {
          const key = JSON.stringify([
            offense.__path || offense.path || offense.file || offense.file_path || offense.relative_path || '',
            offense.start_line || offense.startLine || offense.line || offense.line_number || offense.start_row || offense.row || '',
            offense.check || offense.check_name || '',
            offense.message || '',
          ]);
          if (seen.has(key)) continue;
          seen.add(key);
          writeTaggedLine('theme-check', pc.red, formatThemeCheckError(offense, { cwd }), process.stderr);
        }
      } catch {
        writeThemeCheckErrorsOnly(stdout, process.stdout);
      }
    }
    if (stderr.trim()) {
      writeThemeCheckErrorsOnly(stderr, process.stderr);
    }
  });
  return child;
}

export function serveShopify({ cwd = process.cwd() } = {}) {
  const config = readConfig(cwd) || {};
  const store = config.default_store || config.store || '';
  const args = ['theme', 'dev', '--theme-editor-sync'];
  if (store) args.push(`--store=${store}`);
  return runShopify(args, {
    cwd,
    name: 'shopify',
    stdio: 'pipe',
    onStdout: (chunk) => writeTaggedChunk('shopify', pc.green, chunk, process.stdout),
    onStderr: (chunk) => writeTaggedChunk('shopify', pc.green, chunk, process.stderr),
  });
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
      writeTaggedLine('scripts', pc.yellow, 'built (initial)');
    } catch (err) {
      writeTaggedLine('scripts', pc.yellow, `initial build failed: ${err.message}`, process.stderr);
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
            writeTaggedLine('scripts', pc.yellow, 'rebuilt');
          } catch (err) {
            writeTaggedLine('scripts', pc.yellow, `build failed: ${err.message}`, process.stderr);
          }
        },
      })
    : null;

  let themeCheckRunning = false;
  let themeCheckQueued = false;
  const runThemeCheck = () => {
    if (themeCheckRunning) {
      themeCheckQueued = true;
      return;
    }
    themeCheckRunning = true;
    const child = runThemeCheckFiltered({ cwd });
    child.on('exit', () => {
      themeCheckRunning = false;
      if (themeCheckQueued) {
        themeCheckQueued = false;
        runThemeCheck();
      }
    });
  };

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
            runThemeCheck();
          },
        })
      : null;

  if (includeThemeCheck) {
    runThemeCheck();
  }

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
  const themeCheck = runThemeCheckFiltered({ cwd });
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

