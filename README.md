# climaybe

Shopify CLI for **theme CI/CD** (GitHub Actions, branches, multi-store config) and light **app repo** setup. Same install works in theme or app repositories.

**Commit linting and Cursor bundle (optional in both flows):**

- **Conventional commit linting:** During `climaybe theme init` or `climaybe app init`, you can install [commitlint](https://commitlint.js.org/) and [Husky](https://typicode.github.io/husky) for [Conventional Commits](https://www.conventionalcommits.org/).
- **Cursor rules + skills:** Opt in to Electric Maybe’s bundled [Cursor](https://cursor.com/) rules and skills under `.cursor/rules/` and `.cursor/skills/` (themes, JS, a11y, commits, changelog, Linear, etc.).

## Command layout (Shopify CLI–style)

- **`climaybe theme <command>`** — canonical commands for theme repos (workflows, stores, branches).
- **Same commands at the top level** — `climaybe init` is the same as `climaybe theme init` (backward compatible).
- **`climaybe app init`** — app repos only: writes `project_type: "app"` in `package.json` config, optional commitlint + Cursor bundle. Does **not** install theme GitHub Actions or store/branch setup.
- **`climaybe setup-commitlint`** and **`climaybe add-cursor`** — always at the top level (stack-agnostic).

Theme-only commands refuse to run when `package.json` → `config.project_type` is **`app`**.

## Install

```bash
cd your-shopify-theme-repo   # or app repo
npm install -D climaybe
```

Run commands with `npx climaybe` (or add scripts to your `package.json`).

When a newer `climaybe` is available, the CLI can prompt at startup to update. Press **Enter** to accept the update (`npm install -g climaybe@latest`) or type `n` to skip.

## Quick Start (theme)

```bash
cd your-shopify-theme-repo
npm install -D climaybe
npx climaybe init
# equivalent: npx climaybe theme init
```

The interactive setup will ask for your store URL(s) and configure everything automatically.

## Quick Start (app)

```bash
cd your-shopify-app-repo
npm install -D climaybe
npx climaybe app init
```

Installs optional commitlint/Husky and Cursor rules/skills only. Use [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) for app development and deployment.

## Commands

### `climaybe init` / `climaybe theme init`

Interactive setup that configures your repo for CI/CD.

1. Prompts for your store URL (e.g., `voldt-staging.myshopify.com`)
2. Extracts subdomain as alias, lets you override
3. Asks if you want to add more stores
4. Asks whether to enable optional **preview + cleanup** workflows (default: yes)
5. Asks whether to enable optional **build + Lighthouse** workflows (default: yes)
6. Asks whether to enable **commitlint + Husky** (enforce [conventional commits](https://www.conventionalcommits.org/) on `git commit`)
7. Asks whether to install **Cursor rules + skills** (`.cursor/rules/`, `.cursor/skills/`) — Electric Maybe conventions for themes and AI workflows
8. Based on store count, sets up **single-store** or **multi-store** mode
9. Writes `package.json` config
10. Scaffolds GitHub Actions workflows
11. Creates git branches and store directories (multi-store)
12. Optionally installs commitlint, Husky, and the Cursor bundle (rules + skills)

### `climaybe app init`

Interactive setup for a **Shopify app** repository: optional commitlint + Husky, optional Cursor bundle, and `project_type: "app"` in `package.json` `config`. No theme workflows, stores, or staging/live branches.

### `climaybe add-store` / `climaybe theme add-store`

Add a new store to an existing setup.

```bash
npx climaybe add-store
```

- Prompts for new store URL + alias
- Creates `staging-<alias>` and `live-<alias>` branches
- Creates `stores/<alias>/` directory structure
- If store count goes from 1 to 2+, automatically migrates from single to multi-store mode

### `climaybe switch <alias>` / `climaybe theme switch`

Switch your local dev environment to a specific store (multi-store only).

```bash
npx climaybe switch voldt-norway
```

Copies `stores/<alias>/` JSON files to the repo root so you can preview that store locally.

### `climaybe sync [alias]` / `climaybe theme sync`

Sync root JSON files back to a store directory (multi-store only).

```bash
npx climaybe sync voldt-norway
```

If no alias is given, syncs to the default store.

### `climaybe ensure-branches` / `climaybe theme ensure-branches`

Create missing `staging` and per-store branches (`staging-<alias>`, `live-<alias>`) from your current branch (usually `main`). Use when the repo only has `main` (e.g. after a fresh clone) so the main → staging-&lt;store&gt; sync can run.

```bash
npx climaybe ensure-branches
git push origin --all
```

### `climaybe update-workflows` / `climaybe theme update-workflows`

Refresh GitHub Actions workflows from the latest bundled templates.

```bash
npx climaybe update-workflows
```

Useful after updating the CLI to get the latest workflow improvements.

### `climaybe setup-commitlint`

Set up **only** commitlint + Husky (conventional commits enforced on `git commit`). Use this if you skipped it at init or want to add it later.

```bash
npx climaybe setup-commitlint
```

### `climaybe add-cursor`

Install Electric Maybe **Cursor rules and skills** into `.cursor/rules/` and `.cursor/skills/`. Use this if you skipped the bundle at init or want to refresh from the version of climaybe you have installed.

```bash
npx climaybe add-cursor
```

The previous command name `add-cursor-skill` still works as an alias. Re-running replaces the bundled rule and skill files with the copies shipped by your installed climaybe version (same idea as `update-workflows`).

## Configuration

The CLI writes config into the `config` field of your `package.json`:

```json
{
  "config": {
    "port": 9295,
    "default_store": "voldt-staging.myshopify.com",
    "preview_workflows": true,
    "build_workflows": true,
    "commitlint": true,
    "cursor_skills": true,
    "stores": {
      "voldt-staging": "voldt-staging.myshopify.com",
      "voldt-norway": "voldt-norway.myshopify.com"
    }
  }
}
```

Workflows read this config at runtime — no hardcoded values in YAML files.

## Branch Strategy

### Single-store

```
staging → main
```

- `staging` — development branch
- `main` — production branch

### Multi-store

```
staging → main → staging-<store> → live-<store>
```

- `staging` — development branch
- `main` — shared codebase (not live)
- `staging-<store>` — per-store staging with store-specific JSON data
- `live-<store>` — per-store production

Direct pushes to `staging-<store>` or `live-<store>` are automatically synced back to `main` (no PR; multistore-hotfix-to-main merges the branch into main).

## Workflows

### Shared (both modes)

| Workflow | Purpose |
|----------|---------|
| `ai-changelog.yml` | Reusable workflow. Sends commits to Gemini API, returns classified changelog. |
| `version-bump.yml` | Reusable workflow. Bumps version in `settings_schema.json`, creates git tag. |

### Single-store

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `release-pr-check.yml` | PR from `staging` to `main` | Finds latest tag on main, AI changelog to PR head, creates pre-release patch tag (e.g. v3.1.13) to lock state; posts changelog comment |
| `post-merge-tag.yml` | Push to `main` (merged PR) | Staging→main only: minor bump from latest tag (e.g. v3.1.13 → v3.2.0). No version in PR title |
| `nightly-hotfix.yml` | Cron 02:00 US Eastern | Collects commits since latest tag (incl. hotfix backports), AI changelog, patch bump and tag |

### Multi-store (additional)

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `main-to-staging-stores.yml` (main-to-staging-&lt;store&gt;) | Push to `main` | Merges main into each `staging-<alias>`; root JSONs ignored. For hotfix-backport: if source is `staging-<alias>`, that same staging branch is skipped; if source is `live-<alias>`, `staging-<alias>` is also synced. Skips only on pure store-sync. |
| `stores-to-root.yml` | Push to `staging-*` | From main merge: stores→root. From elsewhere (e.g. Shopify): root→stores |
| `pr-to-live.yml` | After stores-to-root | Opens PR from `staging-<alias>` to `live-<alias>` |
| `root-to-stores.yml` | Push to `live-*` | From main merge: stores→root. From elsewhere: root→stores (same as stores-to-root on staging-*) |
| `multistore-hotfix-to-main.yml` | Push to `staging-*` or `live-*` (and after root-to-stores) | Merges store branch into main (no PR). Skips when push is a merge from main (avoids loop) |

### Optional preview + cleanup package

Enabled via `climaybe init` prompt (`Enable preview + cleanup workflows?`; default: yes).

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `pr-update.yml` | PR opened/synchronize/reopened (base: main, staging, develop, staging-*, live-*) | Shares draft theme, renames with `-PR<number>`, comments preview + customize URLs; uses default store for main/staging/develop, or the store for staging-&lt;alias&gt;/live-&lt;alias&gt; |
| `pr-close.yml` | PR closed (same branch set) | Deletes matching preview themes and comments deleted count + names |
| `reusable-share-theme.yml` | workflow_call | Shares Shopify draft theme and returns `theme_id` |
| `reusable-rename-theme.yml` | workflow_call | Renames shared theme to include `PR<number>` (fails job on rename failure) |
| `reusable-comment-on-pr.yml` | workflow_call | Posts preview comment including Customize URL |
| `reusable-cleanup-themes.yml` | workflow_call | Deletes preview themes by PR number and exposes cleanup outputs |
| `reusable-extract-pr-number.yml` | workflow_call | Extracts padded/unpadded PR number outputs for naming and API-safe usage |

### Optional build + Lighthouse package

Enabled via `climaybe init` prompt (`Enable build + Lighthouse workflows?`; default: yes).

When enabled, `init` validates required theme files and exits with an error if any are missing:
- `_scripts/main.js`
- `_styles/main.css`

`init` auto-creates:
- `assets/`
- `release-notes.md` (starter template)

`climaybe` auto-installs the shared build script at `.climaybe/build-scripts.js` during workflow scaffolding.

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `build-pipeline.yml` | Push to any branch | Runs reusable build and Lighthouse checks (when required secrets exist) |
| `reusable-build.yml` | workflow_call | Runs Node build + Tailwind compile, then commits compiled assets when changed |
| `create-release.yml` | Push tag `v*` | Builds release archive and creates GitHub Release using `release-notes.md` |

### Optional theme dev kit package

During `climaybe init`, you can enable the Electric Maybe theme dev kit (default: yes). This installs local
dev scripts/config defaults (`nodemon.json`, `.theme-check.yml`, `.shopifyignore`, `.prettierrc`,
`.lighthouserc.js`), merges matching `package.json` scripts/dependencies, appends a managed `.gitignore` block,
and optionally adds `.vscode/tasks.json` (default: yes).

If these files already exist, `init` warns that they will be replaced.

You can install/update this later with:

`climaybe add-dev-kit` (or `climaybe theme add-dev-kit`)

## Versioning

- **Version format**: Always three-part (e.g. `v3.2.0`). No version in code or PR title; the system infers from tags.
- **No tags yet?** The system uses `theme_version` from `config/settings_schema.json` (`theme_info`), creates that tag on main (e.g. `v1.0.0`), and continues from there.
- **Staging → main**: On PR, a pre-release patch tag (e.g. v3.1.13) locks the current minor line; on merge, **minor** bump (e.g. v3.1.13 → v3.2.0).
- **Non-staging to main** (hotfix backports, direct commits): **Patch** bump only, via **nightly workflow** at 02:00 US Eastern (not at commit time).
- **Version bump runs only on main** (post-merge-tag and nightly-hotfix). Main-to-staging-stores merges main into each `staging-<alias>` on every push (version bumps and hotfixes). For hotfix-backport, only a `staging-<alias> -> main` source skips syncing back to the same staging branch; a `live-<alias> -> main` source still syncs into `staging-<alias>`.
- Version bumps update `config/settings_schema.json` and, when present, `package.json` `version`.
- **Safety**: The version-bump workflow fails if the new tag would not be **strictly higher** than the latest merged release tag (semver), so the release line cannot step backward.

**Full specification:** For detailed versioning rules, local dev flow, hotfix behavior, and alignment with the external CI/CD doc, see **[CI/CD Reference](docs/CI_CD_REFERENCE.md)**.

## File Sync Rules (Multi-store)

**Synced between root and `stores/<alias>/`:**
- `config/settings_data.json`
- `templates/*.json`
- `sections/*.json`

**NOT synced (travels via branch history):**
- `config/settings_schema.json`
- `locales/*.json`

## Recursive Trigger Prevention

- Hotfix sync merge commits (multistore-hotfix-to-main) contain `[hotfix-backport]` in the message
- Store sync commits contain `[stores-to-root]` or `[root-to-stores]`
- Version bump commits contain `chore(release): bump version`
- All workflows check for these flags and skip accordingly

## GitHub Secrets

Add the following secrets to your GitHub repository (or use **GitLab CI/CD variables** if you use GitLab). You can configure them during `climaybe init` via the GitHub or GitLab CLI.

| Secret | Required | Description |
|--------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for changelog generation |
| `SHOPIFY_STORE_URL` | Set from config | Store URL is set automatically from the store domain(s) you add during init (no prompt). |
| `SHOPIFY_THEME_ACCESS_TOKEN` | Yes* | Theme access token for preview workflows (required when preview is enabled). |
| `SHOP_ACCESS_TOKEN` | Optional* | Required only when optional build workflows are enabled (Lighthouse) |
| `LHCI_GITHUB_APP_TOKEN` | Optional* | Required only when optional build workflows are enabled (Lighthouse) |
| `SHOP_PASSWORD` | Optional | Used by Lighthouse action when your store requires password auth |

**Store URL:** During `climaybe init` (or `add-store`), store URL secret(s) are set from your configured store domain(s); you are only prompted for the theme token.

**Multi-store:** Per-store secrets `SHOPIFY_STORE_URL_<ALIAS>` and `SHOPIFY_THEME_ACCESS_TOKEN_<ALIAS>` — the URL is set from config; you must provide the theme token per store. `<ALIAS>` is uppercase with hyphens as underscores (e.g. `voldt-norway` → `SHOPIFY_STORE_URL_VOLDT_NORWAY`). Preview and cleanup: for PRs targeting **main**, **staging**, or **develop** the workflows use the **default store** (from `config.default_store` or first in `config.stores`); for PRs targeting **staging-&lt;alias&gt;** or **live-&lt;alias&gt;** they use that store’s credentials. Set either the plain `SHOPIFY_*` secrets or the `_<ALIAS>` pair for each store you use in preview.

## Directory Structure (Multi-store)

```
├── assets/
├── config/
├── layout/
├── locales/
├── sections/
├── snippets/
├── templates/
├── stores/
│   ├── voldt-staging/
│   │   ├── config/settings_data.json
│   │   ├── templates/*.json
│   │   └── sections/*.json
│   └── voldt-norway/
│       ├── config/settings_data.json
│       ├── templates/*.json
│       └── sections/*.json
├── package.json
└── .github/workflows/
```

## Releases and versioning

- **Branch:** Single default branch `main`. Feature branches open as PRs into `main`.
- **Versioning:** [SemVer](https://semver.org/). Versions are **bumped automatically** when PRs are merged to `main` using [conventional commits](https://www.conventionalcommits.org/): `fix:` → patch, `feat:` → minor, `BREAKING CHANGE` or `feat!:` → major.
- **Flow:** Merge to `main` → [Release version](.github/workflows/release-version.yml) runs semantic-release (bumps `package.json`, publishes to npm, pushes tag). Optional: tag push runs [Verify release tag](.github/workflows/verify-release-tag.yml) for an extra test pass and tag vs `package.json` check (no publish). Prefer [npm Trusted Publisher](https://docs.npmjs.com/trusted-publishers) (workflow file `release-version.yml`) so no long-lived `NPM_TOKEN` is needed for CI; see [CONTRIBUTING.md](CONTRIBUTING.md). Do not create tags manually; only the Release version workflow creates tags so that tag and package version stay in sync.
- **CI:** Every PR and push to `main` runs tests on Node 20 and 22 ([CI workflow](.github/workflows/ci.yml)).

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch, PR, and conventional-commit details.

## License

MIT — Electric Maybe
