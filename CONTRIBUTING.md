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
- **On merge to main:** The [Release version](.github/workflows/release-version.yml) workflow runs [semantic-release](https://semantic-release.gitbook.io/) on Node 22 (required by semantic-release@25). It analyzes new commits, bumps `package.json`, **publishes to npm**, then pushes the version commit and tag (e.g. `v1.2.0`). If you also use the [Release](.github/workflows/release.yml) workflow, a tag push runs tests and verifies the tag matches `package.json` (publish is not duplicated there).
- **Running semantic-release locally:** Requires Node **22.14+** or **24.10+** (e.g. `nvm use 22` then `npx semantic-release`). The rest of the project supports Node 20+.
- **Do not create tags manually.** Tags must only be created by the [Release version](.github/workflows/release-version.yml) workflow (semantic-release). Manual tags can desync the GitHub tag from `package.json` (e.g. tag `v1.4.0` while package is still `1.3.3`); the [Release](.github/workflows/release.yml) workflow (if enabled) will then fail and remove the invalid tag. To release, merge to `main` with conventional commits, or run `npx semantic-release` locally (Node 22+) so the version bump, npm publish, and tag are created together.
- **npm Trusted Publisher (recommended):** On [npmjs.com](https://www.npmjs.com/) → your package → **Settings** → **Trusted Publisher** → **GitHub Actions**: org/user `electricmaybe`, repo `climaybe`, **Workflow filename** `release-version.yml` (filename only, must match the file under `.github/workflows/`). Leave **Environment name** empty unless you also create a [GitHub Environment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) with that exact name and add `environment: <name>` to the `release` job in `release-version.yml`. CI uses OIDC (`id-token: write`); no `NPM_TOKEN` secret is required for publish once this works. **Local** `npx semantic-release` still needs `npm login` or a token. After a successful OIDC publish, you can restrict package settings to disallow token-based publishing per [npm’s migration tip](https://docs.npmjs.com/trusted-publishers).

## Code and tests

- **Style:** Keep the existing style; no extra linter is required for now.
- **Tests:** Add or update tests under `tests/` for behavior changes. Run with `node scripts/run-tests.js`.

## Questions

Open an [issue](https://github.com/electricmaybe/climaybe/issues) for bugs, feature ideas, or process questions.
