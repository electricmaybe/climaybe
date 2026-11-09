import { defineConfig, devices } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStoreQaPlaywrightDiscovery } from '../lib/playwright-discovery.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const themeRoot = process.env.QA_THEME_ROOT || process.cwd();
const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.QA_PREVIEW_URL || 'http://127.0.0.1:9292';

const projectsFilter = (process.env.QA_PROJECTS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allDevices = [
  {
    name: 'mobile-webkit',
    use: { ...devices['iPhone 13'] },
  },
  {
    name: 'tablet-webkit',
    use: { ...devices['iPad Pro 11'] },
  },
  {
    name: 'desktop-chromium',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1440, height: 900 },
    },
  },
];

const deviceProjects = projectsFilter.length
  ? allDevices.filter((p) => projectsFilter.includes(p.name))
  : allDevices;

const discovery = buildStoreQaPlaywrightDiscovery({
  themeRoot,
  sharedDir: __dirname,
  deviceProjects,
});

/**
 * Shared Playwright config for store QA.
 *
 * Dual projects per viewport:
 * - `<device>` → packaged journeys/universal (testDir = this package dir)
 * - `<device>-theme` → theme `qa/specs` (testDir = `<themeRoot>/qa/specs`)
 *
 * Shared testDir must NOT be the theme root: Playwright skips `node_modules`
 * under testDir, which would hide climaybe's packaged specs.
 */
export default defineConfig({
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: join(themeRoot, 'qa-results', 'html') }],
    ['json', { outputFile: join(themeRoot, 'qa-results', 'results.json') }],
  ],
  outputDir: join(themeRoot, 'qa-results', 'test-output'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
  },
  projects: discovery.projects,
});
