# Contributing to climaybe

Thanks for considering contributing. This document covers how we work.

## Development setup

- **Node.js** 20+
- Clone the repo, then:

  ```bash
  npm install
  node scripts/run-tests.js
  ```

## Branch and PR workflow

- **Default branch:** `main`. All work lands here.
- **Branches:** Create a short-lived branch from `main` for your change (e.g. `fix/init-prompt`, `feat/add-command`).
- **PRs:** Open a pull request into `main`. CI must pass (tests on Node 20 and 22).
- **Merge:** Maintainers merge when CI is green; we use squash or merge commits depending on the change.
- **Commit messages:** Use [conventional commits](https://www.conventionalcommits.org/) so merged PRs get the right version bump:
  - `fix: description` or `fix(scope): description` → patch
  - `feat: description` or `feat(scope): description` → minor
  - `feat!: breaking change` or body with `BREAKING CHANGE:` → major  
  Use present tense (e.g. `fix: resolve init prompt` not `fixed`). If you squash-merge, the PR title becomes the commit on `main` — use a conventional-commit-style title (e.g. `feat: add store switch command`).
- **Enforcement:** [commitlint](https://commitlint.js.org/) runs locally on every `git commit` (via a husky hook) and in CI on PRs: it checks each new commit and the PR title. Fix any reported errors before pushing.

No separate `develop` or release branches; releases are cut from `main` via tags.

## Versioning and releases (automatic)

- **SemVer:** We follow [semver](https://semver.org/): `MAJOR.MINOR.PATCH`.
- **Conventional commits:** Version bumps are derived from commit messages on `main`:
  - `fix:` or `fix(scope):` → **patch** (e.g. 1.1.0 → 1.1.1)
  - `feat:` or `feat(scope):` → **minor** (e.g. 1.1.0 → 1.2.0)
  - `ci:` or `chore:` (workflow/tooling/behavior changes) → **patch**
  - `BREAKING CHANGE:` in body, or `feat!:`, `fix!:` → **major** (e.g. 1.1.0 → 2.0.0)
- **On merge to main:** The [Release version](.github/workflows/release-version.yml) workflow runs [semantic-release](https://semantic-release.gitbook.io/) on Node 22 (required by semantic-release@25). It analyzes new commits, bumps `package.json`, pushes a commit and a tag (e.g. `v1.2.0`). Pushing that tag triggers the [Release](.github/workflows/release.yml) workflow, which runs tests and publishes to npm.
- **Running semantic-release locally:** Requires Node **22.14+** or **24.10+** (e.g. `nvm use 22` then `npx semantic-release`). The rest of the project supports Node 20+.
- **Do not create tags manually.** Tags must only be created by the [Release version](.github/workflows/release-version.yml) workflow (semantic-release). Manual tags can desync the GitHub tag from `package.json` (e.g. tag `v1.4.0` while package is still `1.3.3`); the Release workflow will then fail, remove the invalid tag, and not publish. To release, merge to `main` with conventional commits, or run `npx semantic-release` locally (Node 22+) so the version bump and tag are created together.

## Code and tests

- **Style:** Keep the existing style; no extra linter is required for now.
- **Tests:** Add or update tests under `tests/` for behavior changes. Run with `node scripts/run-tests.js`.

## Questions

Open an [issue](https://github.com/electricmaybe/climaybe/issues) for bugs, feature ideas, or process questions.
