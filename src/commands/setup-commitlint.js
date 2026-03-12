import pc from 'picocolors';
import { writeConfig } from '../lib/config.js';
import { scaffoldCommitlint } from '../lib/commit-tooling.js';

/**
 * Set up commitlint + Husky only (conventional commits on git commit).
 * Can be run standalone or after init without having chosen commitlint at init.
 */
export async function setupCommitlintCommand() {
  console.log(pc.bold('\n  climaybe — Setup commitlint + Husky\n'));

  writeConfig({ commitlint: true });

  console.log(pc.dim('  Installing commitlint + Husky (conventional commits enforced on git commit)...'));
  const skipInstall = process.env.CLIMAYBE_SKIP_INSTALL === '1';
  if (scaffoldCommitlint(process.cwd(), skipInstall ? { skipInstall: true } : {})) {
    console.log(pc.green('\n  commitlint + Husky are set up. Use conventional commits (e.g. feat: add X, fix: resolve Y).\n'));
  } else {
    console.log(pc.yellow('\n  Installation failed or skipped. Run npm install in this repo and try again.\n'));
  }
}
