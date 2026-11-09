# Store QA (climaybe shared core)

Change-aware Playwright store QA shared by Electric Maybe theme repos. Theme repos opt in via climaybe and keep a small `qa/` folder for fixtures and project specs.

## Theme repo contract (`qa/`)

```
qa/
  config.yml      # required — stores, sample products, viewports, feature flags
  manual.yml      # optional — project manual checklist items
  specs/          # optional — project Playwright specs (tagged @…)
```

Schema + examples: [`contract/`](./contract/).

### `qa/config.yml`

| Field | Purpose |
|-------|---------|
| `base_branches` | PR bases that run QA (`live-*` multi-store, `main` single-store). Optional; defaults from climaybe mode. |
| `stores[]` | Per-alias fixtures (`products`, `collections`, optional `preview_base`). |
| `products` / `collections` | Default paths when a store omits them. |
| `viewports` | `mobile` / `tablet` / `desktop` (Playwright device projects). |
| `features` | Toggle newsletter/contact checks; `contact_path`. |
| `console_allowlist` | Third-party substrings ignored by console/network gates. |

### `qa/manual.yml`

List of `{ id, title, expected?, devices?, when?, required_on? }`. Merged with [`manual-shared.yml`](./manual-shared.yml); same `id` overrides shared. `when` ties items to selection areas (`pdp`, `cart`, `car`, …).

### `qa/specs/`

Project Playwright tests. Tag with the same `@funnel` / `@pdp` / `@cart` / `@car` / … labels used by [`selection-rules.json`](./selection-rules.json). CI greps the selected tag set.

## Opt-in (theme repo)

1. Install a climaybe version that includes store QA.
2. Set `"store_qa_workflows": true` in `climaybe.config.json` (or answer yes at `climaybe init`).
3. Ensure `"preview_workflows": true` (QA waits for **PR Update** on the head SHA).
4. Add `qa/config.yml` (start from [`contract/config.example.yml`](./contract/config.example.yml)).
5. Add `@playwright/test` to the theme `package.json` (devDependency).
6. Run `npx climaybe update` to scaffold `store-qa.yml` + `store-qa-manual.yml`.
7. Optional secret: `CURSOR_API_KEY` — one Cursor cloud auto-fix round per PR; no-op when unset. Never auto-merges. Scoped only to the autofix workflow step (not exposed to checkout/install/test).

### Voldt `live-*` pilot

```json
{
  "preview_workflows": true,
  "store_qa_workflows": true,
  "store_qa_base_branches": ["live-*"]
}
```

Plus `qa/config.yml` with `base_branches: [live-*]` and store fixtures. A follow-up agent adds Voldt’s `qa/` folder against this contract; climaybe only ships the shared core + workflows.

## Runtime behavior

- **Trigger:** `workflow_run` after **PR Update** succeeds (no busy-wait). Job `if:` requires same-repo head + base `main` / `live-*` (never staging) before checkout/install. Never drafts/forks.
- **Pinning:** everything uses `workflow_run.head_sha`; PR lookup is exact-SHA only (no `pulls[0]` fallback); if the PR head moved on, the run skips.
- **Preview:** preview comment must include the **full** head SHA (`<!-- climaybe-preview-sha:… -->`); URL pick fails closed on mismatch/empty. Multi-store picks `[alias preview](url)` via `QA_STORE_ALIAS`.
- **Selection:** `git diff` base…head → [`selection-rules.json`](./selection-rules.json) → Playwright `--grep`. No theme changes → `qa-auto` **passes** with `skipped: no theme changes, no preview`. Theme-changing PRs always run the purchase funnel. Scope: small / medium / release.
- **Install:** `npm ci --ignore-scripts` so PR-head lifecycle scripts never see secrets.
- **Gatekeeper:** funnel steps record pass/fail/blocked without aborting the chain; report applies `blockedTagsForFailures` / implications. Console errors aggregate into the auto comment.
- **Checks:** `qa-auto` (blocks merge on failure) + `qa-manual` (pending until checklist boxes are ticked; forge-safe re-eval on bot comment edit bound to head SHA).
- **Comments:** one auto results comment + one manual task-list comment (updated in place; manual ticks preserved across synchronize).
- **Auto-fix:** on failure, one Cursor agent via `CURSOR_API_KEY` **per PR** (`climaybe-qa-autofix-attempted`); after the fix push, still-failing → owner comment, no more agents. No auto-merge.
- **Cost:** single job, browser cache, selected tests only, `workflow_run` instead of polling.

## CLI (CI helpers)

```bash
npx climaybe store-qa gate --base-branch live-euro
npx climaybe store-qa select --base origin/live-euro
npx climaybe store-qa manual
npx climaybe store-qa report
npx climaybe store-qa autofix
npx climaybe store-qa parse-manual
```

## Local run

```bash
export PLAYWRIGHT_BASE_URL='https://your-store.myshopify.com/?preview_theme_id=…'
npx playwright test -c node_modules/climaybe/src/qa/playwright/playwright.config.js --grep '@funnel'
```
