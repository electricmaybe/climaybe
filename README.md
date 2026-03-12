# climaybe

Shopify CI/CD CLI — scaffolds GitHub Actions workflows, branch strategy, and store config for single-store and multi-store theme repositories.

**Commit linting and AI-assisted commits are available as optional setup steps:**

- **Conventional commit linting:** During `climaybe init`, you can choose to automatically install and configure [commitlint](https://commitlint.js.org/) and [Husky](https://typicode.github.io/husky) to enforce [Conventional Commits](https://www.conventionalcommits.org/) in your theme repository.
- **Cursor AI commit skill:** You can also opt-in to installing the [Cursor AI commit skill](https://cursor.so/) (`.cursor/skills/commit/SKILL.md`) for AI-assisted, conventional commit message support in your project.

Both options streamline commit message quality and team workflows but are fully optional during setup.

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
6. Asks whether to enable **commitlint + Husky** (enforce [conventional commits](https://www.conventionalcommits.org/) on `git commit`)
7. Asks whether to add **Cursor commit skill** to the project (`.cursor/skills/commit/SKILL.md`) for AI-assisted conventional commits
8. Based on store count, sets up **single-store** or **multi-store** mode
9. Writes `package.json` config
10. Scaffolds GitHub Actions workflows
11. Creates git branches and store directories (multi-store)
12. Optionally installs commitlint, Husky, and the Cursor skill

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

### `climaybe setup-commitlint`

Set up **only** commitlint + Husky (conventional commits enforced on `git commit`). Use this if you skipped it at init or want to add it later.

```bash
npx climaybe setup-commitlint
```

### `climaybe add-cursor-skill`

Add **only** the Cursor commit skill to this project (`.cursor/skills/commit/SKILL.md`). Use this if you skipped it at init or want to add it later.

```bash
npx climaybe add-cursor-skill
```

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
| `main-to-staging-stores.yml` (main-to-staging-&lt;store&gt;) | Push to `main` | Merges main into each `staging-<alias>`; root JSONs ignored (restored from stores/). Skips on hotfix/version/sync commits |
| `stores-to-root.yml` | Push to `staging-*` | From main merge: stores→root. From elsewhere (e.g. Shopify): root→stores |
| `pr-to-live.yml` | After stores-to-root | Opens PR from `staging-<alias>` to `live-<alias>` |
| `root-to-stores.yml` | Push to `live-*` | From main merge: stores→root. From elsewhere: root→stores (same as stores-to-root on staging-*) |
| `multistore-hotfix-to-main.yml` | Push to `staging-*` or `live-*` (and after root-to-stores) | Merges store branch into main (no PR). Skips when push is a merge from main (avoids loop) |

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

- **Version format**: Always three-part (e.g. `v3.2.0`). No version in code or PR title; the system infers from tags.
- **No tags yet?** The system uses `theme_version` from `config/settings_schema.json` (`theme_info`), creates that tag on main (e.g. `v1.0.0`), and continues from there.
- **Staging → main**: On PR, a pre-release patch tag (e.g. v3.1.13) locks the current minor line; on merge, **minor** bump (e.g. v3.1.13 → v3.2.0).
- **Non-staging to main** (hotfix backports, direct commits): **Patch** bump only, via **nightly workflow** at 02:00 US Eastern (not at commit time).
- **Version bump runs only on main** (post-merge-tag and nightly-hotfix). Main-to-staging-stores then merges main into each `staging-<alias>` on every push (including version bumps and hotfixes from live/staging), so store branches stay in sync with main.
- Version bumps update `config/settings_schema.json` and, when present, `package.json` `version`.

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
