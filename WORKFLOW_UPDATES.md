# Workflow Updates (Changelog)

> **Current specification:** For the full CI/CD workflow and versioning reference (and how to keep the external doc in sync), see **[docs/CI_CD_REFERENCE.md](docs/CI_CD_REFERENCE.md)**. This file is a historical changelog of workflow hardening changes.

---

This document summarizes past CI workflow hardening changes applied in `climaybe`.

## Updated files

- `src/workflows/shared/ai-changelog.yml`
- `src/workflows/single/release-pr-check.yml`
- `src/workflows/single/post-merge-tag.yml`
- `src/workflows/single/nightly-hotfix.yml`
- `src/workflows/shared/version-bump.yml`
- `src/workflows/preview/*` (new optional package)
- `src/workflows/build/*` (new optional package)

## 1) `ai-changelog.yml` improvements

- Switched commit payload handling to multiline plain text output (instead of JSON-encoded string output).
- Writes commits to workspace file `commits-for-ai.txt` and uses `jq --rawfile commits ...` so large histories avoid env size limits and raw log lines are never passed to `jq --argjson` (which requires valid JSON and fails on plain `git log` text).
- Step output `has_commits` (`true` / `false`) gates the AI step instead of a multiline `commits` output blob.
- Added provider fallback chain stability:
  - Gemini (when `GEMINI_API_KEY` is available)
  - GitHub Models fallback
  - Static markdown fallback from commit subjects
- Added provider visibility logs:
  - `gemini`
  - `github-models`
  - `static-fallback`
- Added safer `jq` extraction behavior so parse failures fall through to fallback logic instead of crashing the step.

## 2) Initial version from `settings_schema.json`

When the repo has **no git tags**, versioning workflows now use `theme_version` from `config/settings_schema.json` (the `theme_info` object):

- **release-pr-check**: Reads schema on main; creates and pushes tag `v{theme_version}` (e.g. `v1.0.0`) so pre-release and changelog have a real base. PR comment then shows that tag instead of `v0.0.0`.
- **post-merge-tag**: Same: if no tags, create and push initial tag from schema so changelog and version-bump have a base.
- **version-bump** (reusable): If no tags, uses schema’s `theme_version` as the numeric base for the next bump (no push; caller ensures the tag exists or bump is from that base).
- **nightly-hotfix**: If no tags, creates and pushes initial tag from schema; does not run patch bump on that same run (no untagged commits yet).

Version is normalized to three parts (e.g. `1.0` → `v1.0.0`). If schema is missing or has no `theme_info.theme_version`, fallback remains `v0.0.0`.

## 3) `release-pr-check.yml` improvements

- Fixed `github-script` interpolation risk by passing values via environment variables:
  - `PRE_RELEASE_TAG`
  - `CHANGELOG_TEXT`
- Updated script to read from `process.env` instead of embedding raw `${{ ... }}` output in JavaScript source.
- Added changelog guard:
  - Uses `No changes detected.` when changelog is empty/whitespace.
- Added duplicate pre-release tag protection:
  - If the computed tag already exists locally, reuse it instead of re-creating/re-pushing.

## 4) `post-merge-tag.yml` observability improvements

- Added explicit skip-reason logs for easier debugging, including:
  - hotfix backport commit skip
  - version bump commit skip
  - staging PR title missing a release version
  - push that is not a merged staging release PR

## 5) Optional preview + cleanup workflows package

- Added `init` prompt: `Enable preview + cleanup workflows?`
- Persisted selection in `package.json` config via `preview_workflows` flag.
- Updated workflow scaffolding so `update-workflows` and `add-store` preserve this flag.
- Added optional template workflows under `src/workflows/preview`:
  - `pr-update.yml`
  - `pr-close.yml`
  - `reusable-share-theme.yml`
  - `reusable-rename-theme.yml`
  - `reusable-comment-on-pr.yml`
  - `reusable-cleanup-themes.yml`
  - `reusable-extract-pr-number.yml`
- Included requested hardening behaviors from testing:
  - Preview comment includes `Customize URL` before preview URL.
  - Cleanup comment reports deleted theme count and names.
  - Rename failure fails job (no silent success).
  - PR comment waits for rename completion.
  - PR numbering is standardized via padded/unpadded outputs to avoid cleanup name collisions.

## 6) Optional build + Lighthouse workflows package

- Added `init` prompt: `Enable build + Lighthouse workflows?`
- Persisted selection in `package.json` config via `build_workflows` flag.
- Updated workflow scaffolding so `update-workflows` and `add-store` preserve this flag.
- Added optional template workflows under `src/workflows/build`:
  - `build-pipeline.yml`
  - `reusable-build.yml`
  - `create-release.yml`
- Lighthouse job remains conditionally active via secret checks to avoid hard failures on repos that do not use Lighthouse credentials.

## 7) Preview theme upload fix

- Updated `src/workflows/preview/reusable-share-theme.yml`:
  - Added `actions/checkout@v4` before `shopify theme share`.
  - Added repository root validation (`layout/theme.liquid`) to fail fast on misconfigured runs.
- This prevents empty/404 preview themes caused by sharing from an empty runner workspace.

## 8) Multi-store downstream trigger hardening

- Updated `src/workflows/multi/stores-to-root.yml`:
  - Added `workflow_dispatch` trigger support.
  - Made commit-message gate push-only, so dispatch runs are not incorrectly skipped.
- Updated `src/workflows/multi/main-to-staging-stores.yml`:
  - Added `actions: write` permission.
  - After successful auto-merge to each `staging-<alias>`, explicitly triggers `Stores to Root` via `gh workflow run --ref staging-<alias>`.
- Added deterministic ordering in `main-to-staging-stores.yml`:
  - waits for `Stores to Root` completion on each `staging-<alias>`
  - triggers `PR to Live` only after `Stores to Root` succeeds
- Updated `src/workflows/multi/pr-to-live.yml`:
  - Added `workflow_dispatch` support.
  - Added dual event handling for alias extraction (`workflow_run` and `workflow_dispatch`).
- Kept `PR to Live` sequencing through `Stores to Root` completion to avoid opening deploy PRs before root sync commits land.
- This avoids missing chains while preserving correct run order (`stores-to-root` first, `pr-to-live` second).

## 9) Version bump exclusion hardening for store backports

- Updated `src/workflows/single/nightly-hotfix.yml` commit filtering to exclude:
  - `[skip-store-sync]`
  - `[stores-to-root]`
  - `[root-to-stores]`
  - commits associated with PRs whose source branch is `staging-*` (queried by commit SHA)
- Added fail-safe behavior: commits with missing PR metadata are skipped from bump candidates and logged.
- This prevents `staging-<store> -> main` sync/backport activity from being treated as hotfix input even when merge message formats differ.

## 10) Deploy PR body links for store branches

- Updated `src/workflows/multi/pr-to-live.yml` to resolve the store domain from `package.json` (`config.stores[alias]`).
- Hardened store domain parsing to strip protocol/path segments before URL generation.
- Added support for store-scoped secrets in `pr-to-live.yml`:
  - `SHOPIFY_STORE_URL_<ALIAS>`
  - `SHOPIFY_THEME_ACCESS_TOKEN_<ALIAS>`
  - Alias transformation: uppercase + hyphen to underscore.
- PR body for `staging-<alias> -> live-<alias>` now targets staging/non-live themes:
  - resolves a non-main theme ID via `shopify theme list --json` when possible
  - prioritizes exact branch naming (`<repo>/<staging-branch>`) to avoid generic staging themes
  - includes staging-theme-specific `Customize URL` and `Preview URL`
  - no generic fallback: if branch-specific staging theme is not found, PR body includes a clear warning instead of live/admin links

## 11) Store URL normalization hardening

- Updated `src/lib/prompts.js` `normalizeDomain()` to sanitize user input by stripping:
  - `http://` / `https://`
  - path segments after the host
  - whitespace
- Added strict Shopify domain validation (`<subdomain>.myshopify.com`) at prompt-time.
- This prevents malformed values like `*.myshopify.com/.myshopify.com` from entering `package.json` config.

## 12) Version tag collision guard

- Updated `src/workflows/shared/version-bump.yml` to avoid duplicate tag failures.
- Workflow now:
  - reuses existing tags when found on remote/local
  - creates a new tag only when missing
  - pushes `HEAD` and only pushes tag when a new tag is created

## 13) Preview secret fallback hardening

- Updated preview workflows to support scoped secrets without requiring defaults:
  - `pr-update.yml` resolves default alias from `package.json` and validates scoped/default credential fallback.
  - `reusable-share-theme.yml`, `reusable-rename-theme.yml`, and `reusable-comment-on-pr.yml` now accept `store_alias_secret`.
  - Secret resolution order: `SHOPIFY_*_<ALIAS>` first, then default `SHOPIFY_*`.
- Hardened reusable secret passing:
  - `pr-update.yml` now resolves scoped/default secrets once and passes them explicitly to called reusable workflows.
  - Reusable preview workflows now consume mapped `workflow_call` secrets directly, avoiding runtime dynamic secret lookup gaps.
  - Fixed job dependency graph so `rename-theme` and `comment-on-pr` can safely access resolved alias outputs from `validate-environment`.

## 14) Init prompt defaults: preview and build workflows

- `Enable preview + cleanup workflows?` now defaults to **yes** (was no).
- `Enable build + Lighthouse workflows?` now defaults to **yes** (was no).
- Users can still press `n` to opt out; hitting Enter accepts the default and enables both packages.

## Why these changes were made

- Prevent recurring CI failures caused by unsafe output interpolation and shell parsing edge cases.
- Improve fallback resilience when AI providers return unexpected payloads.
- Make release/tag workflow behavior more transparent and easier to debug.
