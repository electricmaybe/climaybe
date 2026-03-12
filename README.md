# climaybe

Shopify CI/CD CLI — scaffolds GitHub Actions workflows, branch strategy, and store config for single-store and multi-store theme repositories.

## Install

Install in your theme repo (project-only, no global install):

```bash
cd your-shopify-theme-repo
npm install -D climaybe
```

Run commands with `npx climaybe` (or add scripts to your `package.json`).

## Quick Start

```bash
cd your-shopify-theme-repo
npm install -D climaybe
npx climaybe init
```

The interactive setup will ask for your store URL(s) and configure everything automatically.

## Commands

### `climaybe init`

Interactive setup that configures your repo for CI/CD.

1. Prompts for your store URL (e.g., `voldt-staging.myshopify.com`)
2. Extracts subdomain as alias, lets you override
3. Asks if you want to add more stores
4. Asks whether to enable optional **preview + cleanup** workflows
5. Asks whether to enable optional **build + Lighthouse** workflows
6. Based on store count, sets up **single-store** or **multi-store** mode
7. Writes `package.json` config
8. Scaffolds GitHub Actions workflows
9. Creates git branches and store directories (multi-store)

### `climaybe add-store`

Add a new store to an existing setup.

```bash
npx climaybe add-store
```

- Prompts for new store URL + alias
- Creates `staging-<alias>` and `live-<alias>` branches
- Creates `stores/<alias>/` directory structure
- If store count goes from 1 to 2+, automatically migrates from single to multi-store mode

### `climaybe switch <alias>`

Switch your local dev environment to a specific store (multi-store only).

```bash
npx climaybe switch voldt-norway
```

Copies `stores/<alias>/` JSON files to the repo root so you can preview that store locally.

### `climaybe sync [alias]`

Sync root JSON files back to a store directory (multi-store only).

```bash
npx climaybe sync voldt-norway
```

If no alias is given, syncs to the default store.

### `climaybe ensure-branches`

Create missing `staging` and per-store branches (`staging-<alias>`, `live-<alias>`) from your current branch (usually `main`). Use when the repo only has `main` (e.g. after a fresh clone) so the main → staging-&lt;store&gt; sync can run.

```bash
npx climaybe ensure-branches
git push origin --all
```

### `climaybe update-workflows`

Refresh GitHub Actions workflows from the latest bundled templates.

```bash
npx climaybe update-workflows
```

Useful after updating the CLI to get the latest workflow improvements.

## Configuration

The CLI writes config into the `config` field of your `package.json`:

```json
{
  "config": {
    "port": 9295,
    "default_store": "voldt-staging.myshopify.com",
    "preview_workflows": true,
    "build_workflows": true,
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
| `release-pr-check.yml` | PR from `staging` to `main` | Generates changelog, creates pre-release patch tag, posts PR comment |
| `post-merge-tag.yml` | Push to `main` (merged PR) | Staging→main: minor bump (e.g. v3.2.0). Hotfix sync: patch bump (e.g. v3.2.1) |
| `nightly-hotfix.yml` | Cron 02:00 US Eastern | Tags untagged hotfix commits with patch version |

### Multi-store (additional)

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `main-to-staging-stores.yml` (main-to-staging-&lt;store&gt;) | Push to `main` | Opens PRs from main to each `staging-<alias>` branch |
| `stores-to-root.yml` | Push to `staging-*` | Copies `stores/<alias>/` JSONs to repo root |
| `pr-to-live.yml` | After stores-to-root | Opens PR from `staging-<alias>` to `live-<alias>` |
| `root-to-stores.yml` | Push to `live-*` (hotfix) | Syncs root JSONs back to `stores/<alias>/` |
| `multistore-hotfix-to-main.yml` | Push to `staging-*` or `live-*` (and after root-to-stores) | Automatically merges store branch into main (no PR); everything is synced back to main |

### Optional preview + cleanup package

Enabled via `climaybe init` prompt (`Enable preview + cleanup workflows?`).

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

Enabled via `climaybe init` prompt (`Enable build + Lighthouse workflows?`).

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `build-pipeline.yml` | Push to `main/staging/develop` | Runs reusable build and Lighthouse checks (when required secrets exist) |
| `reusable-build.yml` | workflow_call | Runs Node build + Tailwind compile, then commits compiled assets when changed |
| `create-release.yml` | Push tag `v*` | Builds release archive and creates GitHub Release using `release-notes.md` |

## Versioning

- **Version format**: Always three-part (e.g. `v3.2.0`). No two-part tags.
- **Release merge** (`staging` → `main`): Minor bump (e.g. `v3.1.12` → `v3.2.0`)
- **Hotfix sync** (`staging-<store>` or `live-<store>` → main via multistore-hotfix-to-main): Patch bump runs immediately (e.g. `v3.2.0` → `v3.2.1`)
- **Other hotfixes** (direct commit to `main`): Patch bump via nightly workflow or manual run
- **PR title convention**: `Release v3.2` or `Release v3.2.0` — the workflow normalizes to three-part

All version bumps update `config/settings_schema.json` automatically.

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
- **Flow:** Merge to `main` → [Release version](.github/workflows/release-version.yml) runs semantic-release (bumps `package.json`, pushes tag) → tag push triggers [Release](.github/workflows/release.yml) (tests + publish to npm). Requires `NPM_TOKEN` secret for npm publish. Do not create tags manually; only the Release version workflow creates tags so that tag and package version stay in sync.
- **CI:** Every PR and push to `main` runs tests on Node 20 and 22 ([CI workflow](.github/workflows/ci.yml)).

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch, PR, and conventional-commit details.

## License

MIT — Electric Maybe
