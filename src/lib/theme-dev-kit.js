import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { readPkg, writePkg, writeClimaybeConfig } from './config.js';

const DEV_KIT_FILES = {
  '.theme-check.yml': `root: .

extends: :nothing

ignore:
  - node_modules/*
  - _styles/
`,
  '.shopifyignore': `_styles
_scripts
.cursorrules
.config
.backups
.github
.vscode
node_modules
.gitignore
LICENSE
package.json
package-lock.json
yarn-error.log
yarn.lock
*.md
`,
  '.prettierrc': `{
  "tabWidth": 2,
  "useTabs": false,
  "plugins": ["@shopify/prettier-plugin-liquid"]
}
`,
  '.lighthouserc.js': `module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:9292'],
      startServerCommand: 'shopify theme serve',
      startServerReadyPattern: 'Preview your theme',
      startServerReadyTimeout: 60000,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
`,
};

const VSCODE_TASKS_FILE = '.vscode/tasks.json';
const VSCODE_TASKS_CONTENT = `{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Shopify",
      "type": "shell",
      "command": "climaybe serve:shopify",
      "isBackground": true,
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": true,
        "panel": "new",
        "group": "develop",
        "showReuseMessage": false,
        "clear": true
      },
      "problemMatcher": []
    },
    {
      "label": "Tailwind",
      "type": "shell",
      "command": "climaybe serve:assets",
      "isBackground": true,
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new",
        "group": "develop",
        "showReuseMessage": false,
        "clear": true
      },
      "problemMatcher": []
    },
    {
      "label": "Run Both Consoles",
      "dependsOn": ["Shopify", "Tailwind"],
      "runOptions": {
        "runOn": "folderOpen"
      }
    }
  ]
}
`;

const GITIGNORE_BLOCK = `# climaybe: theme dev kit (managed)
.vscode
assets/style.css
assets/index.js
.shopify
.vercel
`;

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function mergeGitignore(cwd = process.cwd()) {
  const path = join(cwd, '.gitignore');
  if (!existsSync(path)) {
    writeFileSync(path, GITIGNORE_BLOCK, 'utf-8');
    return;
  }
  const current = readFileSync(path, 'utf-8');
  if (current.includes('# climaybe: theme dev kit (managed)')) return;
  const next = `${current.trimEnd()}\n\n${GITIGNORE_BLOCK}`;
  writeFileSync(path, `${next}\n`, 'utf-8');
}

function mergePackageJson({ packageName = 'shopify-theme', cwd = process.cwd() } = {}) {
  const pkg = readPkg(cwd) || { name: packageName, version: '1.0.0', private: true };
  pkg.devDependencies = { ...(pkg.devDependencies || {}) };

  // Ensure teammates can run climaybe + Tailwind after plain npm install.
  const cliVersion = process.env.CLIMAYBE_PACKAGE_VERSION;
  const climaybeRange = /^\d+\.\d+\.\d+/.test(String(cliVersion || '')) ? `^${cliVersion}` : 'latest';
  if (!pkg.devDependencies.climaybe) pkg.devDependencies.climaybe = climaybeRange;
  if (!pkg.devDependencies.tailwindcss) pkg.devDependencies.tailwindcss = 'latest';

  writePkg(pkg, cwd);
}

export function getDevKitExistingFiles({ includeVSCodeTasks = true, cwd = process.cwd() } = {}) {
  const paths = Object.keys(DEV_KIT_FILES);
  if (includeVSCodeTasks) paths.push(VSCODE_TASKS_FILE);
  return paths.filter((p) => existsSync(join(cwd, p)));
}

export function scaffoldThemeDevKit({
  includeVSCodeTasks = true,
  defaultStoreDomain = '',
  packageName = 'shopify-theme',
  cwd = process.cwd(),
} = {}) {
  for (const [rel, content] of Object.entries(DEV_KIT_FILES)) {
    const dest = join(cwd, rel);
    ensureParent(dest);
    writeFileSync(dest, content, 'utf-8');
  }
  if (includeVSCodeTasks) {
    const dest = join(cwd, VSCODE_TASKS_FILE);
    ensureParent(dest);
    writeFileSync(dest, VSCODE_TASKS_CONTENT, 'utf-8');
  }
  mergeGitignore(cwd);
  mergePackageJson({ packageName, cwd });

  // New source-of-truth config file for climaybe (local dev + CI).
  // We intentionally keep package.json changes minimal (no script injection).
  writeClimaybeConfig(
    {
      port: 9295,
      default_store: defaultStoreDomain || undefined,
      dev_kit: true,
      vscode_tasks: includeVSCodeTasks,
      project_type: 'theme',
    },
    cwd
  );
}
