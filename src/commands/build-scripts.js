import pc from 'picocolors';
import { requireThemeProject } from '../lib/theme-guard.js';
import { buildScripts } from '../lib/build-scripts.js';

export async function buildScriptsCommand(opts = {}) {
  console.log(pc.bold('\n  climaybe — Build scripts\n'));
  if (!requireThemeProject()) return;

  try {
    const minify = opts.minify === true;
    if (global.gc) global.gc();
    const { bundles } = buildScripts({ cwd: process.cwd(), minify });
    if (!bundles || bundles.length === 0) {
      console.log(pc.yellow('  No _scripts/*.js entrypoints found; nothing to build.'));
      return;
    }
    const totalFiles = bundles.reduce((sum, b) => sum + (b.fileCount || 0), 0);
    const mode = minify ? 'minified' : 'readable';
    console.log(pc.green(`  Scripts built (${bundles.length} bundle(s), ${totalFiles} files total, ${mode})`));
    for (const b of bundles) {
      console.log(pc.dim(`  - ${b.entryFile} → ${b.outputPath}`));
    }
    if (global.gc) global.gc();
  } catch (err) {
    console.log(pc.red(`  Build error: ${err.message}`));
    process.exitCode = 1;
  }
}

