import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { requireThemeProject } from '../lib/theme-guard.js';

const MAIN_JS = `// climaybe entrypoint: global theme JS — bundled into assets/index.js, loaded on every page.
//
// Pull in other modules from _scripts/ by importing them here. They get inlined
// into this bundle, so this is how you split code across files:
//
//   import './foo.js';          // run foo.js as part of the page bundle
//   import { init } from './foo.js';
//
// Top-level files in _scripts/ (besides main.js) are emitted as their own bundles.
// Delete the example import once you add real modules.
`;

const MAIN_CSS = `@import "tailwindcss";

/* Import your own stylesheets from _styles/ the same way you import JS modules: */
/*   @import "./foo.css"; */
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

