import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const SHARED_TEST_MATCH = [
  '**/journeys/**/*.spec.js',
  '**/journeys/**/*.spec.mjs',
  '**/journeys/**/*.spec.ts',
  '**/universal/**/*.spec.js',
  '**/universal/**/*.spec.mjs',
  '**/universal/**/*.spec.ts',
];

export const THEME_TEST_MATCH = [
  '**/*.spec.js',
  '**/*.spec.mjs',
  '**/*.spec.ts',
  '**/*.spec.tsx',
];

/**
 * Build Playwright discovery for store QA.
 *
 * Playwright's collectFiles skips any `node_modules` directory under testDir.
 * Therefore shared journeys/universal must use testDir = the package playwright
 * folder (even when that folder lives under node_modules/climaybe/…), and theme
 * qa/specs get a separate project with testDir = `<theme>/qa/specs`.
 *
 * @param {{
 *   themeRoot: string,
 *   sharedDir: string,
 *   deviceProjects: Array<{ name: string, use: object }>,
 * }} opts
 * @returns {{
 *   sharedDir: string,
 *   sharedTestMatch: string[],
 *   themeSpecsDir: string | null,
 *   themeTestMatch: string[],
 *   projects: Array<{ name: string, testDir: string, testMatch: string[], use: object }>,
 * }}
 */
export function buildStoreQaPlaywrightDiscovery(opts) {
  const themeRoot = opts.themeRoot || process.cwd();
  const sharedDir = opts.sharedDir;
  const deviceProjects = opts.deviceProjects || [];
  const themeSpecsDir = existsSync(join(themeRoot, 'qa', 'specs'))
    ? join(themeRoot, 'qa', 'specs')
    : null;

  /** @type {Array<{ name: string, testDir: string, testMatch: string[], use: object }>} */
  const projects = [];
  for (const device of deviceProjects) {
    projects.push({
      name: device.name,
      testDir: sharedDir,
      testMatch: SHARED_TEST_MATCH,
      use: device.use,
    });
    if (themeSpecsDir) {
      projects.push({
        name: `${device.name}-theme`,
        testDir: themeSpecsDir,
        testMatch: THEME_TEST_MATCH,
        use: device.use,
      });
    }
  }

  return {
    sharedDir,
    sharedTestMatch: SHARED_TEST_MATCH,
    themeSpecsDir,
    themeTestMatch: THEME_TEST_MATCH,
    projects,
  };
}
