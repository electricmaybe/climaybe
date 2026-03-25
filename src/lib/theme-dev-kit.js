import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { readPkg, writePkg } from './config.js';

const DEV_KIT_FILES = {
  'nodemon.json': `{
  "watch": ["_scripts"],
  "ext": "js",
  "exec": "npm run scripts:build --silent",
  "quiet": true,
  "no-colours": true,
  "ignore": ["node_modules/**/*", "assets/**/*", "**/*.min.js"],
  "delay": "500",
  "polling": false,
  "legacyWatch": false,
  "restartable": "rs"
}
`,
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
      "command": "yarn shopify:serve",
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
      "command": "yarn tailwind:watch",
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

const PACKAGE_MERGES = {
  scripts: {
    'shopify:serve': 'shopify theme dev --theme-editor-sync --store=$npm_package_config_store',
    'shopify:populate': 'shopify populate --store=$npm_package_config_store',
    'scripts:build': 'node build-scripts.js',
    'scripts:watch': 'nodemon',
    'tailwind:watch':
      `concurrently --kill-others --max-restarts 3 "NODE_ENV=production NODE_OPTIONS='--max-old-space-size=512' ` +
      `npx @tailwindcss/cli -i _styles/main.css -o assets/style.css --watch" "NODE_OPTIONS='--max-old-space-size=256' ` +
      `npm run scripts:watch" "npx -y @shopify/dev-mcp@latest"`,
    'tailwind:build': 'NODE_ENV=production npx @tailwindcss/cli -i _styles/main.css -o assets/style.css --minify && npm run scripts:build',
    'lint:liquid': 'shopify theme check',
    'lint:js': 'eslint ./assets/*.js --config .config/eslint.config.mjs',
    'lint:css': 'node_modules/.bin/stylelint ./assets/*.css --config .config/.stylelintrc.json',
    release: 'node .sys/scripts/release.js',
  },
  devDependencies: {
    '@shopify/prettier-plugin-liquid': '^1.6.3',
    '@tailwindcss/cli': '^4.1.17',
    concurrently: '^8.2.2',
    nodemon: '^3.0.2',
    prettier: '^3.4.2',
    stylelint: '^16.9.0',
    eslint: '^9.11.0',
  },
};

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

function mergePackageJson(defaultStoreDomain = '', cwd = process.cwd()) {
  const pkg = readPkg(cwd) || { name: 'shopify-theme', version: '1.0.0', private: true };
  pkg.config = { ...(pkg.config || {}) };
  if (!pkg.config.store && defaultStoreDomain) pkg.config.store = defaultStoreDomain;
  pkg.scripts = { ...(pkg.scripts || {}), ...PACKAGE_MERGES.scripts };
  pkg.devDependencies = { ...(pkg.devDependencies || {}), ...PACKAGE_MERGES.devDependencies };
  writePkg(pkg, cwd);
}

export function getDevKitExistingFiles({ includeVSCodeTasks = true, cwd = process.cwd() } = {}) {
  const paths = Object.keys(DEV_KIT_FILES);
  if (includeVSCodeTasks) paths.push(VSCODE_TASKS_FILE);
  return paths.filter((p) => existsSync(join(cwd, p)));
}

export function scaffoldThemeDevKit({ includeVSCodeTasks = true, defaultStoreDomain = '', cwd = process.cwd() } = {}) {
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
  mergePackageJson(defaultStoreDomain, cwd);
}
