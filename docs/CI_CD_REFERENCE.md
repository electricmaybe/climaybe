# CI/CD Reference

Full workflow and versioning specification for climaybe. For a quick overview, see [README](../README.md).

## Versioning

- **Format**: Always three-part (e.g. `v3.2.0`). No version is written in code or PR title; the system infers from tags.
- **When there are no git tags**: The system reads `theme_version` from `config/settings_schema.json` (inside the `theme_info` object), creates that version as a tag on main (e.g. `v1.0.0`), and uses it as the base for pre-release and bump logic. So you can set the starting version in the theme’s schema and the first run will tag it.
- **Staging → main (release)**:
  - On PR open/sync: **release-pr-check** finds latest tag on main (e.g. `v3.1.12`), generates AI changelog from that tag to PR head, and creates a **pre-release patch tag** (e.g. `v3.1.13`) on main to lock “last v3.1.x” before merge.
  - On merge: **post-merge-tag** does **minor** bump from latest tag (e.g. `v3.1.13` → `v3.2.0`). Changelog from last tag to HEAD.
- **Non-staging to main** (hotfix backports, direct commits): **Patch** bump only. Not at commit time; **nightly workflow** at 02:00 US Eastern collects commits since latest tag, generates AI changelog, and creates one patch tag.
- All version bumps update `config/settings_schema.json` automatically.

## Local dev (multi-store)

- **Select store**: `climaybe switch <alias>` (e.g. `climaybe switch voldt-staging`). Copies `stores/<alias>/` JSONs to repo root.
- **Edit**: Change root JSONs as needed.
- **Write back**: `climaybe sync [alias]`. If no alias, syncs to the default store. There is no file watcher; sync is manual.

## Hotfix flow (multi-store)

- Direct pushes to **`staging-<store>`** or **`live-<store>`** are synced back to `main` automatically by **multistore-hotfix-to-main**.
- **No PR**: The workflow merges the store branch into `main` and pushes. Merge commit message contains `[hotfix-backport]`.
- **live-***: Same as staging-*: **root-to-stores** detects source (main vs elsewhere). From main → stores→root; from elsewhere → root→stores, then **multistore-hotfix-to-main** merges to main (skips when push was merge from main).
- **main-to-staging-stores** does not run on `[hotfix-backport]`, version-bump, or store-sync commits (`[stores-to-root]`, `[root-to-stores]`), so hotfix syncs never re-trigger release to stores.
- **Root JSON files** (config/settings_data.json, templates/*.json, sections/*.json) are **ignored** between main and staging-&lt;alias&gt;: when main is synced to a store branch, the workflow merges main then restores root from `stores/<alias>/`, so main’s root JSONs never overwrite store-specific data.

## Workflow names and roles

| Concept | File | Trigger | What it does |
|--------|------|---------|--------------|
| main-to-staging-<store> | `main-to-staging-stores.yml` | Push to `main` | Merges main into each `staging-<alias>` (local merge + push). Root JSONs ignored (restored from `stores/<alias>/`). Skips on `[hotfix-backport]`, version-bump, store-sync commits. |
| stores-to-root | `stores-to-root.yml` | Push to `staging-*` | **From main** (merge): copies `stores/<alias>/` → root. **From elsewhere** (Shopify, direct, feature): copies root → `stores/<alias>/`. |
| pr-to-live | `pr-to-live.yml` | After stores-to-root | Opens PR from `staging-<alias>` to `live-<alias>`. |
| root-to-stores | `root-to-stores.yml` | Push to `live-*` | **From main** (merge): copies `stores/<alias>/` → root. **From elsewhere**: copies root → `stores/<alias>/`. Same logic as stores-to-root on staging-*. |
| multistore-hotfix-to-main | `multistore-hotfix-to-main.yml` | Push to `staging-*` or `live-*`; also after Root to Stores (live-*) | Merges store branch into main (no PR). **Skips** when push to `staging-*` or `live-*` is a merge from main (avoids loop). |

- **main-to-staging-stores** reads the store list from `package.json` → `config.stores` (matrix). Other multi-store workflows derive the alias from the branch name (`staging-<alias>`, `live-<alias>`).
- Adding a new store: update `package.json` and run `climaybe add-store` (creates branches and `stores/<alias>/`).

## Recursive trigger prevention

- **Hotfix sync** merge commits: `[hotfix-backport]` in the message.
- **Store sync** commits: `[stores-to-root]` or `[root-to-stores]`.
- **Version bump** commits: `chore(release): bump version`.
- Workflows check for these and skip to avoid loops.

## File sync (multi-store)

**Synced between root and `stores/<alias>/`:**  
`config/settings_data.json`, `templates/*.json`, `sections/*.json`.

**Not synced (branch history only):**  
`config/settings_schema.json`, `locales/*.json`.

## Branch setup

- **main** is the default branch (created by Git when you init or by the host when you create a repo).
- **staging** and per-store branches are created by `climaybe init` or `climaybe ensure-branches`.
- If the repo only has `main` (e.g. after clone), run `climaybe ensure-branches` then `git push origin --all` so **main-to-staging-stores** can open PRs to each `staging-<alias>`.

## Custom steps and optional paths

If you add a step that uses `git checkout` with a pathspec (e.g. `locales/**/*.json`), Git fails when no files match: `pathspec 'locales/**/*.json' did not match any file(s) known to git`. To avoid that, only run the checkout when the path exists, or use a shell loop so the command is a no-op when there are no files:

```bash
# Safe: only run when directory exists
if [ -d "locales" ]; then
  git checkout main -- locales/
fi
```

Or with a glob that might match nothing:

```bash
# Safe: loop over existing files (no-op if none)
find locales -name "*.json" 2>/dev/null | while read -r f; do
  git checkout main -- "$f"
done
```

---

## Updating the external CI/CD doc

When the implementation changes, update the external “CI/CD – Developer Communication Standard” doc (e.g. Notion) as follows so it stays aligned with this codebase:

| Topic | Doc change |
|-------|------------|
| **Versiyonlama** | Version always three-part (e.g. `v3.2.0`). No version in code or PR title; system infers from tags. Staging→main: pre-release patch tag on PR (e.g. v3.1.13), then minor on merge (v3.2.0). Non-staging (hotfix): patch only via nightly 02:00 US Eastern. |
| **§2.2 Local preview** | Replace `--stores=` with `climaybe switch <alias>`. Build steps: (1) `climaybe switch <alias>`, (2) edit root, (3) `climaybe sync [alias]` (no watch). |
| **§2.4** | Use workflow name “main-to-staging-<store>” and note climaybe file: `main-to-staging-stores.yml`. |
| **§2.6 Hotfixler** | Hotfixes from both `staging-<store>` and `live-<store>` are synced to main automatically (no PR; branch is merged into main). Replace “main’e commit atılır” with “main’e merge edilir (otomatik senkronizasyon).” For live-*: root-to-stores runs first, then multistore-hotfix-to-main merges into main. |
| **§2.7 Versiyon bump** | “Staging→main merge: minor bump (anında). Staging dışı (hotfix): patch bump sadece gece 02:00 US Eastern nightly workflow ile; commit anında tag yok.” |
| **Yapılacaklar – komut** | Use `climaybe add-store` (not “setup add-store”). |
| **Yapılacaklar – prompt** | Optional: “Store URL” and “Alias” as prompt labels; alias default from subdomain. |
| **Yapılacaklar – workflow/store list** | main-to-staging-<store> uses `package.json` config.stores for matrix; other workflows derive alias from branch name. New store = package.json update + `climaybe add-store` (branch + dir creation). |
