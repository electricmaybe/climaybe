TAP version 13
# Subtest: CLI
    # Subtest: registers theme subgroup with init
    ok 1 - registers theme subgroup with init
      ---
      duration_ms: 2.206625
      ...
    # Subtest: registers root init as shorthand for theme init
    ok 2 - registers root init as shorthand for theme init
      ---
      duration_ms: 0.899583
      ...
    # Subtest: registers theme reinit and root reinit
    ok 3 - registers theme reinit and root reinit
      ---
      duration_ms: 0.196708
      ...
    # Subtest: registers theme and root add-store, switch, sync, add-dev-kit, ensure-branches, update
    ok 4 - registers theme and root add-store, switch, sync, add-dev-kit, ensure-branches, update
      ---
      duration_ms: 0.211791
      ...
    # Subtest: registers migrate-legacy-config on theme and root
    ok 5 - registers migrate-legacy-config on theme and root
      ---
      duration_ms: 0.306166
      ...
    # Subtest: registers build-scripts on theme and root
    ok 6 - registers build-scripts on theme and root
      ---
      duration_ms: 0.149458
      ...
    # Subtest: registers create-entrypoints on theme and root
    ok 7 - registers create-entrypoints on theme and root
      ---
      duration_ms: 0.143916
      ...
    # Subtest: registers build-schemas on theme and root with --dry-run and --list options
    ok 8 - registers build-schemas on theme and root with --dry-run and --list options
      ---
      duration_ms: 0.162875
      ...
    # Subtest: registers app init
    ok 9 - registers app init
      ---
      duration_ms: 0.227083
      ...
    # Subtest: registers setup-commitlint and add-cursor at root only
    ok 10 - registers setup-commitlint and add-cursor at root only
      ---
      duration_ms: 0.237333
      ...
    # Subtest: registers serve flags with theme-check opt-in
    ok 11 - registers serve flags with theme-check opt-in
      ---
      duration_ms: 0.524042
      ...
    1..11
ok 1 - CLI
  ---
  duration_ms: 6.320208
  type: 'suite'
  ...
1..1
# tests 11
# suites 1
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 115.879083
TAP version 13
#   climaybe — Add AI ruleset
#   Electric Maybe AI ruleset → .config/ai/ (rules, skills, agents)
#   Editor bridges: .cursor, CLAUDE.md
#   Edit rules in .config/ai/ — every bridged editor reads the same files.
#   See .config/ai/rules/00-rule-index.mdc for which rules apply when.
#   climaybe — Add AI ruleset
#   Electric Maybe AI ruleset → .config/ai/ (rules, skills, agents)
#   Editor bridges: .cursor
#   Edit rules in .config/ai/ — every bridged editor reads the same files.
#   See .config/ai/rules/00-rule-index.mdc for which rules apply when.
# Subtest: add-cursor-skill command
    # Subtest: writes config (cursor_skills + ai_editors) and installs the ruleset + bridges
    ok 1 - writes config (cursor_skills + ai_editors) and installs the ruleset + bridges
      ---
      duration_ms: 25.990584
      ...
    # Subtest: does not throw when no package.json (writes climaybe.config.json instead)
    ok 2 - does not throw when no package.json (writes climaybe.config.json instead)
      ---
      duration_ms: 26.324083
      ...
    1..2
ok 1 - add-cursor-skill command
  ---
  duration_ms: 53.171667
  type: 'suite'
  ...
1..1
# tests 2
# suites 1
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 129.22225
TAP version 13
#   climaybe — Add Store
#   No climaybe config found. Run "climaybe theme init" (or "climaybe init") first.
#   climaybe — Add Store
#   Add a new store
#   Added store: second → second.myshopify.com
#   Created branch: staging-second
#   Created branch: live-second
#   Created store directory: stores/second/
#   Migrating from single-store to multi-store mode...
#   Created branch: staging-main
#   Created branch: live-main
#   Created store directory: stores/main/
#   Scaffolded 10 workflow(s) → .github/workflows/
#   Mode: multi-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Migration complete — workflows updated to multi-store mode.
#   Branch protection: skipped (no GitHub origin remote).
#   Store added successfully!
#   New branches: staging-second, live-second
#   Store dir: stores/second/
# Subtest: add-store command
    # Subtest: exits without error when no config (prints message)
    ok 1 - exits without error when no config (prints message)
      ---
      duration_ms: 2.135458
      ...
    # Subtest: migrates single-store to multi-store and creates branches/dirs for both stores
    ok 2 - migrates single-store to multi-store and creates branches/dirs for both stores
      ---
      duration_ms: 421.291583
      ...
    1..2
ok 1 - add-store command
  ---
  duration_ms: 424.144
  type: 'suite'
  ...
1..1
# tests 2
# suites 1
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 508.24625
TAP version 13
#   climaybe — Ensure Branches
#   No climaybe config found. Run "climaybe theme init" (or "climaybe init") first.
#   climaybe — Ensure Branches
#   Not a git repository. Run "git init" or clone the repo first.
#   climaybe — Ensure Branches
#   Current branch: main
#   Mode: single-store (1 store(s))
#   Created branch: staging
#   Branches ensured.
#   No origin remote found.
#   Push them after adding a remote so CI can run:
#     git remote add origin <url>
#     git push origin --all
#   climaybe — Ensure Branches
#   Current branch: main
#   Mode: multi-store (2 store(s))
#   Created branch: staging
#   Created branch: staging-foo
#   Created branch: live-foo
#   Created branch: staging-bar
#   Created branch: live-bar
#   Branches ensured.
#   No origin remote found.
#   Push them after adding a remote so CI can run:
#     git remote add origin <url>
#     git push origin --all
#   climaybe — Ensure Branches
#   Current branch: main
#   Mode: single-store (1 store(s))
#   Created branch: staging
#   Branches ensured.
#   Pushed ensured branches to origin.
#   Branch protection: skipped (no GitHub origin remote).
# Subtest: ensure-branches command
    # Subtest: exits without error when no config (prints message)
    ok 1 - exits without error when no config (prints message)
      ---
      duration_ms: 3.923958
      ...
    # Subtest: exits without error when not a git repo (prints message)
    ok 2 - exits without error when not a git repo (prints message)
      ---
      duration_ms: 19.340292
      ...
    # Subtest: creates only staging branch in single-store mode
    ok 3 - creates only staging branch in single-store mode
      ---
      duration_ms: 271.689958
      ...
    # Subtest: creates staging and per-store branches in multi-store mode
    ok 4 - creates staging and per-store branches in multi-store mode
      ---
      duration_ms: 461.607166
      ...
    # Subtest: pushes ensured branches to origin when remote exists
    ok 5 - pushes ensured branches to origin when remote exists
      ---
      duration_ms: 370.620291
      ...
    1..5
ok 1 - ensure-branches command
  ---
  duration_ms: 1128.094584
  type: 'suite'
  ...
1..1
# tests 5
# suites 1
# pass 5
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1194.762458
TAP version 13
#   climaybe — Setup commitlint + Husky
#   Installing commitlint + Husky (conventional commits enforced on git commit)...
#   commitlint + Husky are set up. Use conventional commits (e.g. feat: add X, fix: resolve Y).
#   climaybe — Setup commitlint + Husky
#   Installing commitlint + Husky (conventional commits enforced on git commit)...
#   Installation failed or skipped. Run npm install in this repo and try again.
# Subtest: setup-commitlint command
    # Subtest: writes config.commitlint and scaffolds commitlint when package.json exists
    ok 1 - writes config.commitlint and scaffolds commitlint when package.json exists
      ---
      duration_ms: 3.467834
      ...
    # Subtest: does not throw when no package.json (writes climaybe.config.json instead)
    ok 2 - does not throw when no package.json (writes climaybe.config.json instead)
      ---
      duration_ms: 0.733708
      ...
    1..2
ok 1 - setup-commitlint command
  ---
  duration_ms: 5.15825
  type: 'suite'
  ...
1..1
# tests 2
# suites 1
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 77.826375
TAP version 13
#   climaybe — Switch Store
#   Switch is only available in multi-store mode.
#   climaybe — Switch Store
#   Unknown store alias: "unknown"
#   Available: a, b
#   climaybe — Switch Store
#   Copied 1 file(s) from stores/norway/ → root
#   Switched to store: norway
#   Root JSON files now reflect this store's data.
#   Use "climaybe theme sync" (or "climaybe sync") to write changes back.
# Subtest: switch command
    # Subtest: exits without error in single-store mode (no switch)
    ok 1 - exits without error in single-store mode (no switch)
      ---
      duration_ms: 3.303333
      ...
    # Subtest: exits without error for unknown alias in multi-store
    ok 2 - exits without error for unknown alias in multi-store
      ---
      duration_ms: 1.491333
      ...
    # Subtest: updates default_store and copies store json in multi-store mode
    ok 3 - updates default_store and copies store json in multi-store mode
      ---
      duration_ms: 4.163208
      ...
    1..3
ok 1 - switch command
  ---
  duration_ms: 10.142333
  type: 'suite'
  ...
1..1
# tests 3
# suites 1
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 78.613792
TAP version 13
#   climaybe — Sync to Store
#   Sync is only available in multi-store mode.
# Subtest: sync command
    # Subtest: exits without error in single-store mode
    ok 1 - exits without error in single-store mode
      ---
      duration_ms: 3.503917
      ...
    1..1
ok 1 - sync command
  ---
  duration_ms: 4.303125
  type: 'suite'
  ...
1..1
# tests 1
# suites 1
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 69.977916
TAP version 13
#   climaybe — Update
#   No climaybe config found. Run "climaybe theme init" (or "climaybe init") first.
#   climaybe — Update
#   Scaffolded 5 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Project files updated!
# Subtest: update command
    # Subtest: exits without error when no config (prints message)
    ok 1 - exits without error when no config (prints message)
      ---
      duration_ms: 2.550625
      ...
    # Subtest: refreshes theme dev-kit package and gitignore when config exists
    ok 2 - refreshes theme dev-kit package and gitignore when config exists
      ---
      duration_ms: 5.622417
      ...
    1..2
ok 1 - update command
  ---
  duration_ms: 8.922416
  type: 'suite'
  ...
1..1
# tests 2
# suites 1
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 84.269542
TAP version 13
# Subtest: branch-protection
    # Subtest: getBranchProtectionTargets
        # Subtest: protects main and unprotects live branches in single-store mode
        ok 1 - protects main and unprotects live branches in single-store mode
          ---
          duration_ms: 0.457083
          ...
        # Subtest: protects live branches and unprotects main in multi-store mode
        ok 2 - protects live branches and unprotects main in multi-store mode
          ---
          duration_ms: 0.05975
          ...
        # Subtest: defaults to single-store protection of main with no aliases
        ok 3 - defaults to single-store protection of main with no aliases
          ---
          duration_ms: 0.04825
          ...
        1..3
    ok 1 - getBranchProtectionTargets
      ---
      duration_ms: 0.919584
      type: 'suite'
      ...
    # Subtest: buildBranchProtectionPayload
        # Subtest: requires PRs and allows no bypass users by default
        ok 1 - requires PRs and allows no bypass users by default
          ---
          duration_ms: 0.225417
          ...
        # Subtest: grants the live-branch bypass users when allowShopifyBypass is set
        ok 2 - grants the live-branch bypass users when allowShopifyBypass is set
          ---
          duration_ms: 0.046667
          ...
        1..2
    ok 2 - buildBranchProtectionPayload
      ---
      duration_ms: 0.326125
      type: 'suite'
      ...
    # Subtest: syncBranchProtection
        # Subtest: skips when there is no GitHub origin remote
        ok 1 - skips when there is no GitHub origin remote
          ---
          duration_ms: 21.427417
          ...
        1..1
    ok 3 - syncBranchProtection
      ---
      duration_ms: 21.557916
      type: 'suite'
      ...
    # Subtest: logBranchProtectionResult
        # Subtest: reports a skip reason without listing branches
        ok 1 - reports a skip reason without listing branches
          ---
          duration_ms: 1.07625
          ...
        # Subtest: reports applied, removed, and pending branches
        ok 2 - reports applied, removed, and pending branches
          ---
          duration_ms: 0.326042
          ...
        # Subtest: reports failures with action and branch
        ok 3 - reports failures with action and branch
          ---
          duration_ms: 0.302625
          ...
        # Subtest: reports no changes needed when nothing happened
        ok 4 - reports no changes needed when nothing happened
          ---
          duration_ms: 0.276208
          ...
        1..4
    ok 4 - logBranchProtectionResult
      ---
      duration_ms: 2.2715
      type: 'suite'
      ...
    1..4
ok 1 - branch-protection
  ---
  duration_ms: 25.756166
  type: 'suite'
  ...
1..1
# tests 10
# suites 5
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 92.328917
TAP version 13
# Subtest: build-workflows helpers
    # Subtest: reports missing required build workflow paths
    ok 1 - reports missing required build workflow paths
      ---
      duration_ms: 1.333666
      ...
    # Subtest: creates default build files when missing
    ok 2 - creates default build files when missing
      ---
      duration_ms: 0.887292
      ...
    # Subtest: stops reporting files once requirements exist
    ok 3 - stops reporting files once requirements exist
      ---
      duration_ms: 2.181166
      ...
    1..3
ok 1 - build-workflows helpers
  ---
  duration_ms: 5.34575
  type: 'suite'
  ...
1..1
# tests 3
# suites 1
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 65.679084
TAP version 13
# Subtest: cli-version
    # Subtest: prefers package.json version in dev checkout
    ok 1 - prefers package.json version in dev checkout
      ---
      duration_ms: 2.132875
      ...
    # Subtest: prefers baked version file in packaged install
    ok 2 - prefers baked version file in packaged install
      ---
      duration_ms: 0.961167
      ...
    1..2
ok 1 - cli-version
  ---
  duration_ms: 3.980292
  type: 'suite'
  ...
1..1
# tests 2
# suites 1
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 63.210709
TAP version 13
# Subtest: commit-tooling
    # Subtest: scaffoldCommitlint
        # Subtest: returns false when no package.json
        ok 1 - returns false when no package.json
          ---
          duration_ms: 0.6965
          ...
        # Subtest: writes commitlint.config.js, .husky/commit-msg, and updates package.json when skipInstall
        ok 2 - writes commitlint.config.js, .husky/commit-msg, and updates package.json when skipInstall
          ---
          duration_ms: 1.914875
          ...
        1..2
    ok 1 - scaffoldCommitlint
      ---
      duration_ms: 2.949209
      type: 'suite'
      ...
    1..1
ok 1 - commit-tooling
  ---
  duration_ms: 3.496292
  type: 'suite'
  ...
1..1
# tests 2
# suites 2
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 66.344041
TAP version 13
# Subtest: config
    # Subtest: readPkg
        # Subtest: returns null when package.json does not exist
        ok 1 - returns null when package.json does not exist
          ---
          duration_ms: 0.774834
          ...
        # Subtest: returns parsed package.json when it exists
        ok 2 - returns parsed package.json when it exists
          ---
          duration_ms: 1.348625
          ...
        1..2
    ok 1 - readPkg
      ---
      duration_ms: 2.423584
      type: 'suite'
      ...
    # Subtest: readConfig
        # Subtest: returns null when no package.json and no climaybe config file
        ok 1 - returns null when no package.json and no climaybe config file
          ---
          duration_ms: 0.299833
          ...
        # Subtest: returns null when package.json has no config key
        ok 2 - returns null when package.json has no config key
          ---
          duration_ms: 1.298667
          ...
        # Subtest: returns climaybe.config.json when present
        ok 3 - returns climaybe.config.json when present
          ---
          duration_ms: 0.629667
          ...
        # Subtest: returns config object when present
        ok 4 - returns config object when present
          ---
          duration_ms: 0.607167
          ...
        1..4
    ok 2 - readConfig
      ---
      duration_ms: 3.646125
      type: 'suite'
      ...
    # Subtest: writeConfig
        # Subtest: creates climaybe.config.json when missing
        ok 1 - creates climaybe.config.json when missing
          ---
          duration_ms: 0.74675
          ...
        # Subtest: merges config into existing climaybe.config.json
        ok 2 - merges config into existing climaybe.config.json
          ---
          duration_ms: 0.673125
          ...
        # Subtest: does not create package.json by default
        ok 3 - does not create package.json by default
          ---
          duration_ms: 0.488416
          ...
        # Subtest: can also write legacy package.json config when enabled
        ok 4 - can also write legacy package.json config when enabled
          ---
          duration_ms: 20.101
          ...
        1..4
    ok 3 - writeConfig
      ---
      duration_ms: 22.20025
      type: 'suite'
      ...
    # Subtest: migrateLegacyPackageConfigToClimaybe
        # Subtest: writes climaybe.config.json from package.json config when missing
        ok 1 - writes climaybe.config.json from package.json config when missing
          ---
          duration_ms: 1.0125
          ...
        1..1
    ok 4 - migrateLegacyPackageConfigToClimaybe
      ---
      duration_ms: 1.075458
      type: 'suite'
      ...
    # Subtest: getStoreDomainFromBranch
        # Subtest: returns null when not a git repository
        ok 1 - returns null when not a git repository
          ---
          duration_ms: 17.57225
          ...
        # Subtest: returns domain when branch is staging-<alias>
        ok 2 - returns domain when branch is staging-<alias>
          ---
          duration_ms: 193.5435
          ...
        # Subtest: returns domain when branch is live-<alias>
        ok 3 - returns domain when branch is live-<alias>
          ---
          duration_ms: 168.325958
          ...
        # Subtest: returns null when branch alias is not in stores
        ok 4 - returns null when branch alias is not in stores
          ---
          duration_ms: 159.33
          ...
        1..4
    ok 5 - getStoreDomainFromBranch
      ---
      duration_ms: 539.071041
      type: 'suite'
      ...
    # Subtest: getProjectType
        # Subtest: returns theme when project_type missing or theme
        ok 1 - returns theme when project_type missing or theme
          ---
          duration_ms: 1.193417
          ...
        # Subtest: returns app when project_type is app
        ok 2 - returns app when project_type is app
          ---
          duration_ms: 0.452625
          ...
        1..2
    ok 6 - getProjectType
      ---
      duration_ms: 1.708667
      type: 'suite'
      ...
    # Subtest: isThemeProjectForAppInit
        # Subtest: returns false when no config
        ok 1 - returns false when no config
          ---
          duration_ms: 0.206958
          ...
        # Subtest: returns true for legacy stores or project_type theme
        ok 2 - returns true for legacy stores or project_type theme
          ---
          duration_ms: 0.918292
          ...
        # Subtest: returns false for app project_type without stores
        ok 3 - returns false for app project_type without stores
          ---
          duration_ms: 0.405
          ...
        1..3
    ok 7 - isThemeProjectForAppInit
      ---
      duration_ms: 1.586709
      type: 'suite'
      ...
    # Subtest: getAliasForDefaultStore
        # Subtest: returns null when default_store is missing or does not match any store
        ok 1 - returns null when default_store is missing or does not match any store
          ---
          duration_ms: 1.065625
          ...
        # Subtest: returns the alias whose domain equals default_store
        ok 2 - returns the alias whose domain equals default_store
          ---
          duration_ms: 0.64125
          ...
        1..2
    ok 8 - getAliasForDefaultStore
      ---
      duration_ms: 1.767
      type: 'suite'
      ...
    # Subtest: getStoreAliases
        # Subtest: returns empty array when no config or no stores
        ok 1 - returns empty array when no config or no stores
          ---
          duration_ms: 0.624291
          ...
        # Subtest: returns keys of config.stores
        ok 2 - returns keys of config.stores
          ---
          duration_ms: 0.492375
          ...
        1..2
    ok 9 - getStoreAliases
      ---
      duration_ms: 1.157292
      type: 'suite'
      ...
    # Subtest: getMode
        # Subtest: returns single when one store
        ok 1 - returns single when one store
          ---
          duration_ms: 0.4665
          ...
        # Subtest: returns multi when multiple stores
        ok 2 - returns multi when multiple stores
          ---
          duration_ms: 0.650333
          ...
        1..2
    ok 10 - getMode
      ---
      duration_ms: 1.155416
      type: 'suite'
      ...
    # Subtest: isPreviewWorkflowsEnabled
        # Subtest: returns false when not set or false
        ok 1 - returns false when not set or false
          ---
          duration_ms: 0.6035
          ...
        # Subtest: returns true when preview_workflows is true
        ok 2 - returns true when preview_workflows is true
          ---
          duration_ms: 0.473041
          ...
        1..2
    ok 11 - isPreviewWorkflowsEnabled
      ---
      duration_ms: 1.114208
      type: 'suite'
      ...
    # Subtest: isBuildWorkflowsEnabled
        # Subtest: returns false when not set or false
        ok 1 - returns false when not set or false
          ---
          duration_ms: 0.476958
          ...
        # Subtest: returns true when build_workflows is true
        ok 2 - returns true when build_workflows is true
          ---
          duration_ms: 0.5085
          ...
        1..2
    ok 12 - isBuildWorkflowsEnabled
      ---
      duration_ms: 1.027541
      type: 'suite'
      ...
    # Subtest: isCommitlintEnabled
        # Subtest: returns false when not set or false
        ok 1 - returns false when not set or false
          ---
          duration_ms: 0.493208
          ...
        # Subtest: returns true when commitlint is true
        ok 2 - returns true when commitlint is true
          ---
          duration_ms: 0.371083
          ...
        1..2
    ok 13 - isCommitlintEnabled
      ---
      duration_ms: 0.901708
      type: 'suite'
      ...
    # Subtest: isCursorSkillsEnabled
        # Subtest: returns false when not set or false
        ok 1 - returns false when not set or false
          ---
          duration_ms: 0.387875
          ...
        # Subtest: returns true when cursor_skills is true
        ok 2 - returns true when cursor_skills is true
          ---
          duration_ms: 0.482916
          ...
        1..2
    ok 14 - isCursorSkillsEnabled
      ---
      duration_ms: 0.909542
      type: 'suite'
      ...
    # Subtest: addStoreToConfig
        # Subtest: adds store and sets default_store when first
        ok 1 - adds store and sets default_store when first
          ---
          duration_ms: 0.539917
          ...
        # Subtest: adds store without overwriting default_store when not first
        ok 2 - adds store without overwriting default_store when not first
          ---
          duration_ms: 0.485125
          ...
        1..2
    ok 15 - addStoreToConfig
      ---
      duration_ms: 1.05975
      type: 'suite'
      ...
    1..15
ok 1 - config
  ---
  duration_ms: 581.5735
  type: 'suite'
  ...
1..1
# tests 36
# suites 16
# pass 36
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 656.2605
TAP version 13
# file:///Users/efe/dev/13_products/13.01_climaybe/tests/lib/cursor-bundle.test.js:1
# TAP version 13
#     ^^^^^^^
# SyntaxError: Unexpected identifier
#     at ESMLoader.moduleStrategy (node:internal/modules/esm/translators:119:18)
#     at ESMLoader.moduleProvider (node:internal/modules/esm/loader:468:14)
#     at async link (node:internal/modules/esm/module_job:68:21)
# Node.js v18.18.0
# Subtest: /Users/efe/dev/13_products/13.01_climaybe/tests/lib/cursor-bundle.test.js
not ok 1 - /Users/efe/dev/13_products/13.01_climaybe/tests/lib/cursor-bundle.test.js
  ---
  duration_ms: 47.666041
  failureType: 'testCodeFailure'
  exitCode: 1
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 51.17
TAP version 13
#   Created branch: staging
#   Created branch: staging
#   Branch "staging" already exists, skipping.
#   Created branch: staging-myshop
#   Created branch: live-myshop
#   Created branch: staging
#   Created initial commit.
#   Initialized git repository.
# Subtest: git
    # Subtest: isGitRepo
        # Subtest: returns false in non-git directory
        ok 1 - returns false in non-git directory
          ---
          duration_ms: 19.294042
          ...
        # Subtest: returns true after git init
        ok 2 - returns true after git init
          ---
          duration_ms: 41.643
          ...
        1..2
    ok 1 - isGitRepo
      ---
      duration_ms: 61.764917
      type: 'suite'
      ...
    # Subtest: currentBranch
        # Subtest: returns branch name in repo with commit
        ok 1 - returns branch name in repo with commit
          ---
          duration_ms: 143.765834
          ...
        1..1
    ok 2 - currentBranch
      ---
      duration_ms: 143.842208
      type: 'suite'
      ...
    # Subtest: branchExists
        # Subtest: returns false for non-existent branch
        ok 1 - returns false for non-existent branch
          ---
          duration_ms: 121.753333
          ...
        # Subtest: returns true after creating branch
        ok 2 - returns true after creating branch
          ---
          duration_ms: 148.68325
          ...
        1..2
    ok 3 - branchExists
      ---
      duration_ms: 270.546833
      type: 'suite'
      ...
    # Subtest: createBranch
        # Subtest: creates branch and returns true
        ok 1 - creates branch and returns true
          ---
          duration_ms: 180.609875
          ...
        # Subtest: skips and returns false when branch already exists
        ok 2 - skips and returns false when branch already exists
          ---
          duration_ms: 181.250166
          ...
        1..2
    ok 4 - createBranch
      ---
      duration_ms: 362.279625
      type: 'suite'
      ...
    # Subtest: createStoreBranches
        # Subtest: creates staging-<alias> and live-<alias>
        ok 1 - creates staging-<alias> and live-<alias>
          ---
          duration_ms: 225.56825
          ...
        1..1
    ok 5 - createStoreBranches
      ---
      duration_ms: 225.645
      type: 'suite'
      ...
    # Subtest: ensureStagingBranch
        # Subtest: creates staging branch
        ok 1 - creates staging branch
          ---
          duration_ms: 165.487667
          ...
        1..1
    ok 6 - ensureStagingBranch
      ---
      duration_ms: 165.682
      type: 'suite'
      ...
    # Subtest: ensureInitialCommit
        # Subtest: creates initial commit when repo has none
        ok 1 - creates initial commit when repo has none
          ---
          duration_ms: 152.388583
          ...
        # Subtest: does not error when commit already exists
        ok 2 - does not error when commit already exists
          ---
          duration_ms: 143.171625
          ...
        1..2
    ok 7 - ensureInitialCommit
      ---
      duration_ms: 295.974042
      type: 'suite'
      ...
    # Subtest: ensureGitRepo
        # Subtest: runs git init when not a repo
        ok 1 - runs git init when not a repo
          ---
          duration_ms: 67.930458
          ...
        # Subtest: does not error when already a repo
        ok 2 - does not error when already a repo
          ---
          duration_ms: 108.447583
          ...
        1..2
    ok 8 - ensureGitRepo
      ---
      duration_ms: 176.62525
      type: 'suite'
      ...
    # Subtest: getLatestTagVersion
        # Subtest: returns null in non-git directory
        ok 1 - returns null in non-git directory
          ---
          duration_ms: 16.721291
          ...
        # Subtest: returns null when repo has no v* tags
        ok 2 - returns null when repo has no v* tags
          ---
          duration_ms: 122.392917
          ...
        # Subtest: returns latest version from v* tags (semver sorted)
        ok 3 - returns latest version from v* tags (semver sorted)
          ---
          duration_ms: 187.981125
          ...
        1..3
    ok 9 - getLatestTagVersion
      ---
      duration_ms: 327.198625
      type: 'suite'
      ...
    # Subtest: getSuggestedTagForRelease
        # Subtest: returns v1.0.0 when no tags
        ok 1 - returns v1.0.0 when no tags
          ---
          duration_ms: 157.740417
          ...
        # Subtest: returns next patch when latest tag exists
        ok 2 - returns next patch when latest tag exists
          ---
          duration_ms: 145.455292
          ...
        1..2
    ok 10 - getSuggestedTagForRelease
      ---
      duration_ms: 303.273875
      type: 'suite'
      ...
    # Subtest: addOriginRemote
        # Subtest: adds a GitHub origin from an owner/repo slug
        ok 1 - adds a GitHub origin from an owner/repo slug
          ---
          duration_ms: 114.131583
          ...
        # Subtest: builds a GitLab URL when host is gitlab
        ok 2 - builds a GitLab URL when host is gitlab
          ---
          duration_ms: 61.321167
          ...
        # Subtest: is a no-op when origin already exists (returns existing URL)
        ok 3 - is a no-op when origin already exists (returns existing URL)
          ---
          duration_ms: 74.527541
          ...
        1..3
    ok 11 - addOriginRemote
      ---
      duration_ms: 250.272083
      type: 'suite'
      ...
    1..11
ok 1 - git
  ---
  duration_ms: 2583.942208
  type: 'suite'
  ...
1..1
# tests 21
# suites 12
# pass 21
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2653.917333
TAP version 13
# Subtest: github-secrets prompting behavior
    # Subtest: marks all single-store init prompts as optional
    ok 1 - marks all single-store init prompts as optional
      ---
      duration_ms: 0.274083
      ...
    # Subtest: marks all multi-store init prompts as optional
    ok 2 - marks all multi-store init prompts as optional
      ---
      duration_ms: 0.090375
      ...
    # Subtest: marks add-store prompts as optional
    ok 3 - marks add-store prompts as optional
      ---
      duration_ms: 0.746375
      ...
    1..3
ok 1 - github-secrets prompting behavior
  ---
  duration_ms: 1.811542
  type: 'suite'
  ...
1..1
# tests 3
# suites 1
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 67.9865
TAP version 13
# Subtest: prompts (pure helpers)
    # Subtest: extractAlias
        # Subtest: strips .myshopify.com suffix
        ok 1 - strips .myshopify.com suffix
          ---
          duration_ms: 0.249584
          ...
        # Subtest: is case-insensitive for suffix
        ok 2 - is case-insensitive for suffix
          ---
          duration_ms: 0.048625
          ...
        # Subtest: trims whitespace
        ok 3 - trims whitespace
          ---
          duration_ms: 0.040709
          ...
        1..3
    ok 1 - extractAlias
      ---
      duration_ms: 0.681042
      type: 'suite'
      ...
    # Subtest: normalizeDomain
        # Subtest: appends .myshopify.com when missing
        ok 1 - appends .myshopify.com when missing
          ---
          duration_ms: 0.226459
          ...
        # Subtest: leaves domain unchanged when already .myshopify.com
        ok 2 - leaves domain unchanged when already .myshopify.com
          ---
          duration_ms: 0.04075
          ...
        # Subtest: strips protocol and path
        ok 3 - strips protocol and path
          ---
          duration_ms: 0.151917
          ...
        # Subtest: lowercases result
        ok 4 - lowercases result
          ---
          duration_ms: 0.04425
          ...
        # Subtest: trims and collapses spaces
        ok 5 - trims and collapses spaces
          ---
          duration_ms: 0.042333
          ...
        # Subtest: returns empty string for empty input
        ok 6 - returns empty string for empty input
          ---
          duration_ms: 0.046958
          ...
        1..6
    ok 2 - normalizeDomain
      ---
      duration_ms: 0.849208
      type: 'suite'
      ...
    # Subtest: isValidShopifyDomain
        # Subtest: accepts valid subdomain.myshopify.com
        ok 1 - accepts valid subdomain.myshopify.com
          ---
          duration_ms: 0.124875
          ...
        # Subtest: rejects missing or wrong suffix
        ok 2 - rejects missing or wrong suffix
          ---
          duration_ms: 0.126958
          ...
        # Subtest: rejects leading hyphen or invalid chars in subdomain
        ok 3 - rejects leading hyphen or invalid chars in subdomain
          ---
          duration_ms: 0.039083
          ...
        # Subtest: rejects empty
        ok 4 - rejects empty
          ---
          duration_ms: 0.127042
          ...
        1..4
    ok 3 - isValidShopifyDomain
      ---
      duration_ms: 0.556791
      type: 'suite'
      ...
    1..3
ok 1 - prompts (pure helpers)
  ---
  duration_ms: 2.710084
  type: 'suite'
  ...
# Subtest: prompts (interactive helpers)
    # Subtest: promptAiEditors
        # Subtest: returns the selected editor keys
        ok 1 - returns the selected editor keys
          ---
          duration_ms: 0.536875
          ...
        # Subtest: falls back to cursor when nothing is selected
        ok 2 - falls back to cursor when nothing is selected
          ---
          duration_ms: 0.689208
          ...
        1..2
    ok 1 - promptAiEditors
      ---
      duration_ms: 1.394375
      type: 'suite'
      ...
    # Subtest: promptOwnerRepo
        # Subtest: returns a valid owner/repo slug
        ok 1 - returns a valid owner/repo slug
          ---
          duration_ms: 0.4795
          ...
        1..1
    ok 2 - promptOwnerRepo
      ---
      duration_ms: 0.544375
      type: 'suite'
      ...
    # Subtest: promptNoRemoteAction
        # Subtest: returns the chosen action
        ok 1 - returns the chosen action
          ---
          duration_ms: 0.171875
          ...
        # Subtest: can choose to skip
        ok 2 - can choose to skip
          ---
          duration_ms: 0.096667
          ...
        1..2
    ok 3 - promptNoRemoteAction
      ---
      duration_ms: 0.519834
      type: 'suite'
      ...
    1..3
ok 2 - prompts (interactive helpers)
  ---
  duration_ms: 2.593542
  type: 'suite'
  ...
1..2
# tests 18
# suites 8
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 81.598959
TAP version 13
# Subtest: schema-builder
    # Subtest: injects a JSON schema below the inline-comment marker
    ok 1 - injects a JSON schema below the inline-comment marker
      ---
      duration_ms: 6.772625
      ...
    # Subtest: injects a schema from a JS module (CommonJS)
    ok 2 - injects a schema from a JS module (CommonJS)
      ---
      duration_ms: 3.61875
      ...
    # Subtest: preserves the inline-comment marker after building
    ok 3 - preserves the inline-comment marker after building
      ---
      duration_ms: 1.579583
      ...
    # Subtest: replaces the previously generated schema on rebuild (idempotent)
    ok 4 - replaces the previously generated schema on rebuild (idempotent)
      ---
      duration_ms: 2.290042
      ...
    # Subtest: injects the same schema into multiple sections (shared)
    ok 5 - injects the same schema into multiple sections (shared)
      ---
      duration_ms: 2.724209
      ...
    # Subtest: supports schema partials via require()
    ok 6 - supports schema partials via require()
      ---
      duration_ms: 6.191292
      ...
    # Subtest: supports common fieldsets spread into settings arrays
    ok 7 - supports common fieldsets spread into settings arrays
      ---
      duration_ms: 2.926791
      ...
    # Subtest: supports looping fieldsets via factory functions
    ok 8 - supports looping fieldsets via factory functions
      ---
      duration_ms: 6.408166
      ...
    # Subtest: supports function exports with inline-comment overrides
    ok 9 - supports function exports with inline-comment overrides
      ---
      duration_ms: 7.448417
      ...
    # Subtest: merges inline JSON with static schema exports (inline wins)
    ok 10 - merges inline JSON with static schema exports (inline wins)
      ---
      duration_ms: 1.336792
      ...
    # Subtest: preserves inline override across rebuilds
    ok 11 - preserves inline override across rebuilds
      ---
      duration_ms: 1.3215
      ...
    # Subtest: does not write files in dry run mode
    ok 12 - does not write files in dry run mode
      ---
      duration_ms: 1.6415
      ...
    # Subtest: reports errors for missing schema files
    ok 13 - reports errors for missing schema files
      ---
      duration_ms: 1.587292
      ...
    # Subtest: returns empty results when sections/ does not exist
    ok 14 - returns empty results when sections/ does not exist
      ---
      duration_ms: 0.226959
      ...
    # Subtest: skips section files without the marker
    ok 15 - skips section files without the marker
      ---
      duration_ms: 0.816583
      ...
    # Subtest: handles whitespace-control dashes in the marker
    ok 16 - handles whitespace-control dashes in the marker
      ---
      duration_ms: 1.46075
      ...
    # Subtest: supports double-quoted schema names
    ok 17 - supports double-quoted schema names
      ---
      duration_ms: 1.251083
      ...
    # Subtest: rebuilds correctly after theme editor modifies markup above the marker
    ok 18 - rebuilds correctly after theme editor modifies markup above the marker
      ---
      duration_ms: 1.427458
      ...
    # Subtest: processes blocks/*.liquid files alongside sections/
    ok 19 - processes blocks/*.liquid files alongside sections/
      ---
      duration_ms: 2.545333
      ...
    # Subtest: lists blocks with schema markers in listSectionsWithSchemaRefs
    ok 20 - lists blocks with schema markers in listSectionsWithSchemaRefs
      ---
      duration_ms: 1.049625
      ...
    # Subtest: lists available schema files
    ok 21 - lists available schema files
      ---
      duration_ms: 1.278833
      ...
    # Subtest: returns empty array when _schemas/ does not exist
    ok 22 - returns empty array when _schemas/ does not exist
      ---
      duration_ms: 0.154708
      ...
    # Subtest: lists sections that contain the inline-comment marker
    ok 23 - lists sections that contain the inline-comment marker
      ---
      duration_ms: 0.944958
      ...
    # Subtest: returns empty array when sections/ does not exist
    ok 24 - returns empty array when sections/ does not exist
      ---
      duration_ms: 0.161875
      ...
    1..24
ok 1 - schema-builder
  ---
  duration_ms: 58.627291
  type: 'suite'
  ...
1..1
# tests 24
# suites 1
# pass 24
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 127.920666
TAP version 13
#   Copied 1 file(s) from root → stores/storea/
#   Copied 1 file(s) from stores/storeb/ → root
#   CLIMAYBE_SERVE_STORE="nope" is not a known store alias.
#   Available: storea, storeb
# Subtest: serve-multi-store
    # Subtest: returns true in single-store mode without touching files
    ok 1 - returns true in single-store mode without touching files
      ---
      duration_ms: 3.481875
      ...
    # Subtest: when switching serve target, saves root JSONs to previous store then loads selected store
    ok 2 - when switching serve target, saves root JSONs to previous store then loads selected store
      ---
      duration_ms: 52.072042
      ...
    # Subtest: returns false when CLIMAYBE_SERVE_STORE is not a known alias
    ok 3 - returns false when CLIMAYBE_SERVE_STORE is not a known alias
      ---
      duration_ms: 11.059292
      ...
    # Subtest: when explicit store matches default_store, does not overwrite root from store dir
    ok 4 - when explicit store matches default_store, does not overwrite root from store dir
      ---
      duration_ms: 2.862708
      ...
    1..4
ok 1 - serve-multi-store
  ---
  duration_ms: 71.8885
  type: 'suite'
  ...
1..1
# tests 4
# suites 1
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 167.712334
TAP version 13
#   Created store directory: stores/myshop/
#   Store directory "stores/nonexistent/" does not exist.
#   Copied 1 file(s) from stores/myshop/ → root
#   Created store directory: stores/myshop/
#   Copied 1 file(s) from root → stores/myshop/
# Subtest: store-sync
    # Subtest: createStoreDirectories
        # Subtest: creates stores/<alias>/config, templates, sections
        ok 1 - creates stores/<alias>/config, templates, sections
          ---
          duration_ms: 2.449625
          ...
        1..1
    ok 1 - createStoreDirectories
      ---
      duration_ms: 2.762792
      type: 'suite'
      ...
    # Subtest: storesToRoot
        # Subtest: returns false when store dir does not exist
        ok 1 - returns false when store dir does not exist
          ---
          duration_ms: 0.276792
          ...
        # Subtest: copies JSON from stores/<alias>/ sync dirs to root
        ok 2 - copies JSON from stores/<alias>/ sync dirs to root
          ---
          duration_ms: 2.542917
          ...
        1..2
    ok 2 - storesToRoot
      ---
      duration_ms: 2.885417
      type: 'suite'
      ...
    # Subtest: rootToStores
        # Subtest: copies JSON from root sync dirs to stores/<alias>/
        ok 1 - copies JSON from root sync dirs to stores/<alias>/
          ---
          duration_ms: 2.136792
          ...
        1..1
    ok 3 - rootToStores
      ---
      duration_ms: 2.189667
      type: 'suite'
      ...
    1..3
ok 1 - store-sync
  ---
  duration_ms: 8.405958
  type: 'suite'
  ...
1..1
# tests 4
# suites 4
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 76.4885
TAP version 13
# Subtest: theme-dev-kit
    # Subtest: scaffolds dev kit files, writes climaybe.config.json, and adds climaybe + tailwindcss deps
    ok 1 - scaffolds dev kit files, writes climaybe.config.json, and adds climaybe + tailwindcss deps
      ---
      duration_ms: 8.74025
      ...
    # Subtest: detects existing files that will be replaced
    ok 2 - detects existing files that will be replaced
      ---
      duration_ms: 1.017417
      ...
    # Subtest: updates existing managed gitignore block on rerun
    ok 3 - updates existing managed gitignore block on rerun
      ---
      duration_ms: 2.169792
      ...
    1..3
ok 1 - theme-dev-kit
  ---
  duration_ms: 12.76775
  type: 'suite'
  ...
1..1
# tests 3
# suites 1
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 82.207458
TAP version 13
#   This command is for theme repos only. This project has project_type: app.
#   Use climaybe app init for app setup; theme stores and workflows do not apply here.
# Subtest: theme-guard
    # Subtest: returns true for theme project
    ok 1 - returns true for theme project
      ---
      duration_ms: 1.610042
      ...
    # Subtest: returns false for app project
    ok 2 - returns false for app project
      ---
      duration_ms: 1.019875
      ...
    1..2
ok 1 - theme-guard
  ---
  duration_ms: 3.828958
  type: 'suite'
  ...
1..1
# tests 2
# suites 1
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 66.805834
TAP version 13
# Subtest: update-notifier
    # Subtest: isVersionGreater
        # Subtest: returns true when candidate is newer
        ok 1 - returns true when candidate is newer
          ---
          duration_ms: 0.491292
          ...
        # Subtest: returns false when versions are equal or older
        ok 2 - returns false when versions are equal or older
          ---
          duration_ms: 0.251833
          ...
        # Subtest: handles optional v prefix and pre-release metadata
        ok 3 - handles optional v prefix and pre-release metadata
          ---
          duration_ms: 0.061042
          ...
        # Subtest: returns false for invalid versions
        ok 4 - returns false for invalid versions
          ---
          duration_ms: 0.051958
          ...
        1..4
    ok 1 - isVersionGreater
      ---
      duration_ms: 1.383208
      type: 'suite'
      ...
    # Subtest: resolveInstallScope
        # Subtest: prefers local when packageDir indicates node_modules install
        ok 1 - prefers local when packageDir indicates node_modules install
          ---
          duration_ms: 0.710042
          ...
        # Subtest: prefers local when package.json exists in cwd (fallback)
        ok 2 - prefers local when package.json exists in cwd (fallback)
          ---
          duration_ms: 163.573709
          ...
        # Subtest: falls back to global when local project does not exist
        ok 3 - falls back to global when local project does not exist
          ---
          duration_ms: 128.363833
          ...
        1..3
    ok 2 - resolveInstallScope
      ---
      duration_ms: 292.873667
      type: 'suite'
      ...
    # Subtest: local install policy
        # Subtest: always installs climaybe in dependencies for local updates
        ok 1 - always installs climaybe in dependencies for local updates
          ---
          duration_ms: 1.401708
          ...
        1..1
    ok 3 - local install policy
      ---
      duration_ms: 1.472208
      type: 'suite'
      ...
    1..3
ok 1 - update-notifier
  ---
  duration_ms: 296.395416
  type: 'suite'
  ...
1..1
# tests 8
# suites 4
# pass 8
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 366.154916
TAP version 13
#   Scaffolded 5 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Scaffolded 10 workflow(s) → .github/workflows/
#   Mode: multi-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Scaffolded 10 workflow(s) → .github/workflows/
#   Mode: multi-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Scaffolded 10 workflow(s) → .github/workflows/
#   Mode: multi-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Scaffolded 10 workflow(s) → .github/workflows/
#   Mode: multi-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Scaffolded 10 workflow(s) → .github/workflows/
#   Mode: multi-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Scaffolded 10 workflow(s) → .github/workflows/
#   Mode: multi-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Scaffolded 5 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Scaffolded 14 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: enabled
#   Build workflows: disabled
#   Scaffolded 8 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: disabled
#   Build workflows: enabled
#   Scaffolded 5 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Scaffolded 8 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: disabled
#   Build workflows: enabled
#   Scaffolded 8 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: disabled
#   Build workflows: enabled
#   Scaffolded 5 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Scaffolded 5 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Scaffolded 5 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: disabled
#   Build workflows: disabled
# Subtest: workflows
    # Subtest: scaffoldWorkflows
        # Subtest: creates .github/workflows and copies shared + single by default
        ok 1 - creates .github/workflows and copies shared + single by default
          ---
          duration_ms: 4.796
          ...
        # Subtest: includes multi workflows when mode is multi
        ok 2 - includes multi workflows when mode is multi
          ---
          duration_ms: 4.825666
          ...
        # Subtest: keeps live hotfixes eligible for same-store staging sync
        ok 3 - keeps live hotfixes eligible for same-store staging sync
          ---
          duration_ms: 3.921333
          ...
        # Subtest: skips no-op main-to-staging sync when trees are identical
        ok 4 - skips no-op main-to-staging sync when trees are identical
          ---
          duration_ms: 4.111667
          ...
        # Subtest: skips no-op hotfix backports when source and main trees match
        ok 5 - skips no-op hotfix backports when source and main trees match
          ---
          duration_ms: 3.518084
          ...
        # Subtest: backports store sync commits without waiting for next root edit
        ok 6 - backports store sync commits without waiting for next root edit
          ---
          duration_ms: 3.124958
          ...
        # Subtest: keeps live minified assets out of main hotfix backports
        ok 7 - keeps live minified assets out of main hotfix backports
          ---
          duration_ms: 8.507583
          ...
        # Subtest: ignores no-op commits in nightly hotfix tagging
        ok 8 - ignores no-op commits in nightly hotfix tagging
          ---
          duration_ms: 2.319417
          ...
        # Subtest: includes preview workflows when includePreview is true
        ok 9 - includes preview workflows when includePreview is true
          ---
          duration_ms: 6.483
          ...
        # Subtest: includes build workflows when includeBuild is true
        ok 10 - includes build workflows when includeBuild is true
          ---
          duration_ms: 9.153417
          ...
        # Subtest: reads head commit message safely in post-merge-tag detect step
        ok 11 - reads head commit message safely in post-merge-tag detect step
          ---
          duration_ms: 2.451333
          ...
        # Subtest: wires create-release to tagging workflow completion
        ok 12 - wires create-release to tagging workflow completion
          ---
          duration_ms: 3.009084
          ...
        # Subtest: does not install per-repo build script shims
        ok 13 - does not install per-repo build script shims
          ---
          duration_ms: 4.746291
          ...
        # Subtest: overwrites existing workflows on second scaffold
        ok 14 - overwrites existing workflows on second scaffold
          ---
          duration_ms: 3.247417
          ...
        1..14
    ok 1 - scaffoldWorkflows
      ---
      duration_ms: 65.083666
      type: 'suite'
      ...
    1..1
ok 1 - workflows
  ---
  duration_ms: 65.586791
  type: 'suite'
  ...
1..1
# tests 14
# suites 2
# pass 14
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 128.616833
TAP version 13
# Subtest: build-scripts
    # Subtest: inlines imported files and strips ESM import syntax from output bundle
    ok 1 - inlines imported files and strips ESM import syntax from output bundle
      ---
      duration_ms: 8.903458
      ...
    # Subtest: strips common ESM export syntax from output bundle
    ok 2 - strips common ESM export syntax from output bundle
      ---
      duration_ms: 2.335083
      ...
    # Subtest: strips multiline named export blocks from output bundle
    ok 3 - strips multiline named export blocks from output bundle
      ---
      duration_ms: 2.962458
      ...
    # Subtest: strips multiline named imports from main.js style headers
    ok 4 - strips multiline named imports from main.js style headers
      ---
      duration_ms: 3.243125
      ...
    # Subtest: strips compact imports and import attributes from output bundle
    ok 5 - strips compact imports and import attributes from output bundle
      ---
      duration_ms: 2.896625
      ...
    # Subtest: strips bare side-effect import lines without semicolon from main.js
    ok 6 - strips bare side-effect import lines without semicolon from main.js
      ---
      duration_ms: 1.966875
      ...
    # Subtest: builds additional top-level entrypoints to separate asset files
    ok 7 - builds additional top-level entrypoints to separate asset files
      ---
      duration_ms: 2.2505
      ...
    # Subtest: does not emit separate bundles for files imported by main.js
    ok 8 - does not emit separate bundles for files imported by main.js
      ---
      duration_ms: 3.208542
      ...
    # Subtest: does not emit separate bundles for files imported by another top-level entrypoint
    ok 9 - does not emit separate bundles for files imported by another top-level entrypoint
      ---
      duration_ms: 2.388167
      ...
    # Subtest: isolates side-effect-only imports to avoid duplicate top-level identifier collisions
    ok 10 - isolates side-effect-only imports to avoid duplicate top-level identifier collisions
      ---
      duration_ms: 3.668667
      ...
    # Subtest: preserves script comments in production mode
    ok 11 - preserves script comments in production mode
      ---
      duration_ms: 1.683334
      ...
    # Subtest: removes orphan assets/*.js that have no _scripts source on a full build
    ok 12 - removes orphan assets/*.js that have no _scripts source on a full build
      ---
      duration_ms: 2.246541
      ...
    # Subtest: does not remove non-js assets or *.js.liquid files
    ok 13 - does not remove non-js assets or *.js.liquid files
      ---
      duration_ms: 1.528583
      ...
    # Subtest: does not remove other bundle outputs during a targeted single-entry build
    ok 14 - does not remove other bundle outputs during a targeted single-entry build
      ---
      duration_ms: 2.277583
      ...
    # Subtest: does not touch assets when _scripts has no entrypoints
    ok 15 - does not touch assets when _scripts has no entrypoints
      ---
      duration_ms: 0.951791
      ...
    # Subtest: minifies output only when minify option is enabled
    ok 16 - minifies output only when minify option is enabled
      ---
      duration_ms: 1.439083
      ...
    1..16
ok 1 - build-scripts
  ---
  duration_ms: 45.046167
  type: 'suite'
  ...
1..1
# tests 16
# suites 1
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 104.396334
