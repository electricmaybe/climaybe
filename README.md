# climaybe

Shopify CI/CD CLI — scaffolds GitHub Actions workflows, branch strategy, and store config for single-store and multi-store theme repositories.

## Install

```bash
npm install -g climaybe
```

## Quick Start

```bash
cd your-shopify-theme-repo
climaybe init
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
climaybe add-store
```

- Prompts for new store URL + alias
- Creates `staging-<alias>` and `live-<alias>` branches
- Creates `stores/<alias>/` directory structure
- If store count goes from 1 to 2+, automatically migrates from single to multi-store mode

### `climaybe switch <alias>`

Switch your local dev environment to a specific store (multi-store only).

```bash
climaybe switch voldt-norway
```

Copies `stores/<alias>/` JSON files to the repo root so you can preview that store locally.

### `climaybe sync [alias]`

Sync root JSON files back to a store directory (multi-store only).

```bash
climaybe sync voldt-norway
```

If no alias is given, syncs to the default store.

### `climaybe update-workflows`

Refresh GitHub Actions workflows from the latest bundled templates.

```bash
climaybe update-workflows
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
| `post-merge-tag.yml` | Push to `main` (merged PR) | Staging→main: minor bump from PR title. live-*→main (backport): patch bump |
| `nightly-hotfix.yml` | Cron 02:00 US Eastern | Tags untagged hotfix commits with patch version |

### Multi-store (additional)

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `main-to-staging-stores.yml` | Push to `main` | Opens PRs to each `staging-<alias>` branch |
| `stores-to-root.yml` | Push to `staging-*` | Copies `stores/<alias>/` JSONs to repo root |
| `pr-to-live.yml` | After stores-to-root | Opens PR from `staging-<alias>` to `live-<alias>` |
| `root-to-stores.yml` | Push to `live-*` (hotfix) | Syncs root JSONs back to `stores/<alias>/` |
| `hotfix-backport.yml` | After root-to-stores | Creates backport PR to `main` |

### Optional preview + cleanup package

Enabled via `climaybe init` prompt (`Enable preview + cleanup workflows?`).

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `pr-update.yml` | PR opened/synchronize/reopened | Shares draft theme, renames with `-PR<number>`, comments preview + customize URLs |
| `pr-close.yml` | PR closed | Deletes matching preview themes and comments deleted count + names |
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

- **Release merge** (`staging` → `main`): Minor bump (e.g., `v3.1.x` → `v3.2.0`)
- **Hotfix backport merge** (`live-<store>` → `main`): Patch bump runs immediately on merge (e.g., `v3.2.0` → `v3.2.1`)
- **Other hotfixes** (direct commit to `main`): Patch bump via nightly workflow or manual run
- **PR title convention**: `Release v3.2` — the workflow extracts the version from this

All version bumps update `config/settings_schema.json` automatically.

## File Sync Rules (Multi-store)

**Synced between root and `stores/<alias>/`:**
- `config/settings_data.json`
- `templates/*.json`
- `sections/*.json`

**NOT synced (travels via branch history):**
- `config/settings_schema.json`
- `locales/*.json`

## Recursive Trigger Prevention

- Hotfix backport commits contain `[hotfix-backport]` in the message
- Store sync commits contain `[stores-to-root]` or `[root-to-stores]`
- Version bump commits contain `chore(release): bump version`
- All workflows check for these flags and skip accordingly

## GitHub Secrets

Add the following secret to your GitHub repository:

| Secret | Required | Description |
|--------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for changelog generation |
| `SHOPIFY_STORE_URL` | Optional* | Required only when optional preview workflows are enabled |
| `SHOPIFY_CLI_THEME_TOKEN` | Optional* | Required only when optional preview workflows are enabled |
| `SHOP_STORE` | Optional* | Required only when optional build workflows are enabled (Lighthouse) |
| `SHOP_ACCESS_TOKEN` | Optional* | Required only when optional build workflows are enabled (Lighthouse) |
| `LHCI_GITHUB_APP_TOKEN` | Optional* | Required only when optional build workflows are enabled (Lighthouse) |
| `SHOP_PASSWORD` | Optional | Used by Lighthouse action when your store requires password auth |

For multi-store deploy PR links, you can optionally define store-scoped secrets:

- `SHOPIFY_STORE_URL_<ALIAS>`
- `SHOPIFY_CLI_THEME_TOKEN_<ALIAS>`

`<ALIAS>` must be uppercase with hyphens converted to underscores.  
Example: alias `voldt-norway` → `SHOPIFY_STORE_URL_VOLDT_NORWAY`.

Preview workflows also support the same scoped secret pattern and will use:

1. `SHOPIFY_*_<ALIAS>`
2. fallback to `SHOPIFY_*` (default)

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

## License

MIT — Electric Maybe
