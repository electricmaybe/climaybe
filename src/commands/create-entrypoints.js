import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { requireThemeProject } from '../lib/theme-guard.js';

const MAIN_JS = `// climaybe entrypoint: global theme JS
// Add imports here for code you want on every page.
// Top-level files in _scripts/ (besides main.js) are treated as separate bundles.
`;

const MAIN_CSS = `@import "tailwindcss";
`;

export async function createEntrypointsCommand() {
  console.log(pc.bold('\n  climaybe — Create entrypoints\n'));
  if (!requireThemeProject()) return;

  const scriptsDir = join(process.cwd(), '_scripts');
  const stylesDir = join(process.cwd(), '_styles');
  const assetsDir = join(process.cwd(), 'assets');

  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(stylesDir, { recursive: true });
  mkdirSync(assetsDir, { recursive: true });

  const mainJsPath = join(scriptsDir, 'main.js');
  const mainCssPath = join(stylesDir, 'main.css');

  if (!existsSync(mainJsPath)) {
    writeFileSync(mainJsPath, MAIN_JS, 'utf-8');
    console.log(pc.green('  Created _scripts/main.js'));
  } else {
    console.log(pc.dim('  _scripts/main.js already exists (skipped)'));
  }

  if (!existsSync(mainCssPath)) {
    writeFileSync(mainCssPath, MAIN_CSS, 'utf-8');
    console.log(pc.green('  Created _styles/main.css'));
  } else {
    console.log(pc.dim('  _styles/main.css already exists (skipped)'));
  }

  console.log(pc.dim('\n  Next: run `climaybe build` or `climaybe serve`.\n'));
}

