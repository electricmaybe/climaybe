# CI/CD Reference

Full workflow and versioning specification for climaybe. For a quick overview, see [README](../README.md).

## Versioning

- **Format**: Always three-part (e.g. `v3.2.0`). No two-part tags; the workflow normalizes `v3.2` to `v3.2.0`.
- **Release merge** (`staging` → `main`): Minor bump (e.g. `v3.1.12` → `v3.2.0`). Version is read from PR title (`Release v3.2` or `Release v3.2.0`).
- **Hotfix sync** (`staging-<store>` or `live-<store>` → main): Patch bump runs immediately after the merge (e.g. `v3.2.0` → `v3.2.1`). Triggered by merge commits containing `[hotfix-backport]`.
- **Other hotfixes** (direct commits to `main`): Patch bump via nightly workflow (02:00 US Eastern) or manual run.
- All version bumps update `config/settings_schema.json` automatically.

## Local dev (multi-store)

- **Select store**: `climaybe switch <alias>` (e.g. `climaybe switch voldt-staging`). Copies `stores/<alias>/` JSONs to repo root.
- **Edit**: Change root JSONs as needed.
- **Write back**: `climaybe sync [alias]`. If no alias, syncs to the default store. There is no file watcher; sync is manual.

## Hotfix flow (multi-store)

- Direct pushes to **`staging-<store>`** or **`live-<store>`** are synced back to `main` automatically by **multistore-hotfix-to-main**.
- **No PR**: The workflow merges the store branch into `main` and pushes. Merge commit message contains `[hotfix-backport]`.
- **For `live-*` only**: **root-to-stores** runs first (syncs root JSONs to `stores/<alias>/`), then **multistore-hotfix-to-main** merges the branch into `main`.
- **main-to-staging-stores** skips commits with `[hotfix-backport]`, so hotfix syncs are not re-pushed to staging stores.

## Workflow names and roles

| Concept | File | Trigger | What it does |
|--------|------|---------|--------------|
| main-to-staging-<store> | `main-to-staging-stores.yml` | Push to `main` | Opens PRs from main to each `staging-<alias>` branch. Store list from `package.json` config.stores. |
| stores-to-root | `stores-to-root.yml` | Push to `staging-*` | Copies `stores/<alias>/` to repo root. Alias from branch name. |
| pr-to-live | `pr-to-live.yml` | After stores-to-root | Opens PR from `staging-<alias>` to `live-<alias>`. |
| root-to-stores | `root-to-stores.yml` | Push to `live-*` | Syncs root JSONs to `stores/<alias>/`. |
| multistore-hotfix-to-main | `multistore-hotfix-to-main.yml` | Push to `staging-*` or `live-*`; also after Root to Stores (live-*) | Merges store branch into main (no PR). |

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

---

## Updating the external CI/CD doc

When the implementation changes, update the external “CI/CD – Developer Communication Standard” doc (e.g. Notion) as follows so it stays aligned with this codebase:

| Topic | Doc change |
|-------|------------|
| **Versiyonlama** | State that version is always three-part (e.g. `v3.2.0`). Remove “v3.2.0 kullanılacaksa ayrıca standardize edilmeli”; say “Release tag formatı: v3.2.0 (her zaman üç parça).” |
| **§2.2 Local preview** | Replace `--stores=` with `climaybe switch <alias>`. Build steps: (1) `climaybe switch <alias>`, (2) edit root, (3) `climaybe sync [alias]` (no watch). |
| **§2.4** | Use workflow name “main-to-staging-<store>” and note climaybe file: `main-to-staging-stores.yml`. |
| **§2.6 Hotfixler** | Hotfixes from both `staging-<store>` and `live-<store>` are synced to main automatically (no PR; branch is merged into main). Replace “main’e commit atılır” with “main’e merge edilir (otomatik senkronizasyon).” For live-*: root-to-stores runs first, then multistore-hotfix-to-main merges into main. |
| **§2.7 Versiyon bump** | “staging-<store> veya live-<store> → main (multistore-hotfix-to-main) merge’leri patch version bump tetikler.” |
| **Yapılacaklar – komut** | Use `climaybe add-store` (not “setup add-store”). |
| **Yapılacaklar – prompt** | Optional: “Store URL” and “Alias” as prompt labels; alias default from subdomain. |
| **Yapılacaklar – workflow/store list** | main-to-staging-<store> uses `package.json` config.stores for matrix; other workflows derive alias from branch name. New store = package.json update + `climaybe add-store` (branch + dir creation). |
