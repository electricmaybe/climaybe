TAP version 13
# Subtest: CLI
    # Subtest: registers theme subgroup with init
    ok 1 - registers theme subgroup with init
      ---
      duration_ms: 1.869167
      ...
    # Subtest: registers root init as shorthand for theme init
    ok 2 - registers root init as shorthand for theme init
      ---
      duration_ms: 0.328042
      ...
    # Subtest: registers theme reinit and root reinit
    ok 3 - registers theme reinit and root reinit
      ---
      duration_ms: 0.729125
      ...
    # Subtest: registers theme and root add-store, switch, sync, add-dev-kit, ensure-branches, update
    ok 4 - registers theme and root add-store, switch, sync, add-dev-kit, ensure-branches, update
      ---
      duration_ms: 0.261708
      ...
    # Subtest: registers migrate-legacy-config on theme and root
    ok 5 - registers migrate-legacy-config on theme and root
      ---
      duration_ms: 0.324375
      ...
    # Subtest: registers build-scripts on theme and root
    ok 6 - registers build-scripts on theme and root
      ---
      duration_ms: 0.177958
      ...
    # Subtest: registers create-entrypoints on theme and root
    ok 7 - registers create-entrypoints on theme and root
      ---
      duration_ms: 0.221958
      ...
    # Subtest: registers app init
    ok 8 - registers app init
      ---
      duration_ms: 0.186458
      ...
    # Subtest: registers setup-commitlint and add-cursor at root only
    ok 9 - registers setup-commitlint and add-cursor at root only
      ---
      duration_ms: 0.277584
      ...
    # Subtest: registers serve flags with theme-check opt-in
    ok 10 - registers serve flags with theme-check opt-in
      ---
      duration_ms: 0.20775
      ...
    1..10
ok 1 - CLI
  ---
  duration_ms: 5.907334
  type: 'suite'
  ...
1..1
# tests 10
# suites 1
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 217.618584
TAP version 13
#   climaybe — Add Cursor bundle
#   Installed .cursor/rules, .cursor/skills, and .cursor/agents from climaybe bundle.
#   See .cursor/rules/00-rule-index.mdc for which rules apply when.
#   climaybe — Add Cursor bundle
#   Installed .cursor/rules, .cursor/skills, and .cursor/agents from climaybe bundle.
#   See .cursor/rules/00-rule-index.mdc for which rules apply when.
# Subtest: add-cursor-skill command
    # Subtest: writes config.cursor_skills, rules, skills, and agents (theme-translator)
    ok 1 - writes config.cursor_skills, rules, skills, and agents (theme-translator)
      ---
      duration_ms: 24.029584
      ...
    # Subtest: does not throw when no package.json (writes climaybe.config.json instead)
    ok 2 - does not throw when no package.json (writes climaybe.config.json instead)
      ---
      duration_ms: 10.40975
      ...
    1..2
ok 1 - add-cursor-skill command
  ---
  duration_ms: 35.29225
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
# duration_ms 100.388125
TAP version 13
# file:///Users/efe/dev/17_ops/17.01%20Internal%20Tools/climaybe/tests/commands/add-store.test.js:1
# TAP version 13
#     ^^^^^^^
# SyntaxError: Unexpected identifier
#     at ESMLoader.moduleStrategy (node:internal/modules/esm/translators:119:18)
#     at ESMLoader.moduleProvider (node:internal/modules/esm/loader:468:14)
#     at async link (node:internal/modules/esm/module_job:68:21)
# Node.js v18.18.0
# Subtest: /Users/efe/dev/17_ops/17.01 Internal Tools/climaybe/tests/commands/add-store.test.js
not ok 1 - /Users/efe/dev/17_ops/17.01 Internal Tools/climaybe/tests/commands/add-store.test.js
  ---
  duration_ms: 59.930667
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
# duration_ms 64.105666
TAP version 13
# file:///Users/efe/dev/17_ops/17.01%20Internal%20Tools/climaybe/tests/commands/ensure-branches.test.js:1
# TAP version 13
#     ^^^^^^^
# SyntaxError: Unexpected identifier
#     at ESMLoader.moduleStrategy (node:internal/modules/esm/translators:119:18)
#     at ESMLoader.moduleProvider (node:internal/modules/esm/loader:468:14)
#     at async link (node:internal/modules/esm/module_job:68:21)
# Node.js v18.18.0
# Subtest: /Users/efe/dev/17_ops/17.01 Internal Tools/climaybe/tests/commands/ensure-branches.test.js
not ok 1 - /Users/efe/dev/17_ops/17.01 Internal Tools/climaybe/tests/commands/ensure-branches.test.js
  ---
  duration_ms: 42.17875
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
# duration_ms 45.356416
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
      duration_ms: 12.276417
      ...
    # Subtest: does not throw when no package.json (writes climaybe.config.json instead)
    ok 2 - does not throw when no package.json (writes climaybe.config.json instead)
      ---
      duration_ms: 3.952334
      ...
    1..2
ok 1 - setup-commitlint command
  ---
  duration_ms: 17.18975
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
# duration_ms 82.857417
TAP version 13
# file:///Users/efe/dev/17_ops/17.01%20Internal%20Tools/climaybe/tests/commands/switch.test.js:1
# TAP version 13
#     ^^^^^^^
# SyntaxError: Unexpected identifier
#     at ESMLoader.moduleStrategy (node:internal/modules/esm/translators:119:18)
#     at ESMLoader.moduleProvider (node:internal/modules/esm/loader:468:14)
#     at async link (node:internal/modules/esm/module_job:68:21)
# Node.js v18.18.0
# Subtest: /Users/efe/dev/17_ops/17.01 Internal Tools/climaybe/tests/commands/switch.test.js
not ok 1 - /Users/efe/dev/17_ops/17.01 Internal Tools/climaybe/tests/commands/switch.test.js
  ---
  duration_ms: 46.922125
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
# duration_ms 50.213208
TAP version 13
#   climaybe — Sync to Store
#   Sync is only available in multi-store mode.
# Subtest: sync command
    # Subtest: exits without error in single-store mode
    ok 1 - exits without error in single-store mode
      ---
      duration_ms: 2.798667
      ...
    1..1
ok 1 - sync command
  ---
  duration_ms: 3.697208
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
# duration_ms 83.535708
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
      duration_ms: 1.561292
      ...
    # Subtest: refreshes theme dev-kit package and gitignore when config exists
    ok 2 - refreshes theme dev-kit package and gitignore when config exists
      ---
      duration_ms: 13.151834
      ...
    1..2
ok 1 - update command
  ---
  duration_ms: 15.436667
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
# duration_ms 86.64325
TAP version 13
# file:///Users/efe/dev/17_ops/17.01%20Internal%20Tools/climaybe/tests/lib/branch-protection.test.js:1
# TAP version 13
#     ^^^^^^^
# SyntaxError: Unexpected identifier
#     at ESMLoader.moduleStrategy (node:internal/modules/esm/translators:119:18)
#     at ESMLoader.moduleProvider (node:internal/modules/esm/loader:468:14)
#     at async link (node:internal/modules/esm/module_job:68:21)
# Node.js v18.18.0
# Subtest: /Users/efe/dev/17_ops/17.01 Internal Tools/climaybe/tests/lib/branch-protection.test.js
not ok 1 - /Users/efe/dev/17_ops/17.01 Internal Tools/climaybe/tests/lib/branch-protection.test.js
  ---
  duration_ms: 42.279125
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
# duration_ms 45.325167
TAP version 13
# Subtest: build-workflows helpers
    # Subtest: reports missing required build workflow paths
    ok 1 - reports missing required build workflow paths
      ---
      duration_ms: 4.032708
      ...
    # Subtest: creates default build files when missing
    ok 2 - creates default build files when missing
      ---
      duration_ms: 1.426083
      ...
    # Subtest: stops reporting files once requirements exist
    ok 3 - stops reporting files once requirements exist
      ---
      duration_ms: 14.85675
      ...
    1..3
ok 1 - build-workflows helpers
  ---
  duration_ms: 23.412166
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
# duration_ms 137.501458
TAP version 13
# Subtest: cli-version
    # Subtest: prefers package.json version in dev checkout
    ok 1 - prefers package.json version in dev checkout
      ---
      duration_ms: 4.362541
      ...
    # Subtest: prefers baked version file in packaged install
    ok 2 - prefers baked version file in packaged install
      ---
      duration_ms: 1.372833
      ...
    1..2
ok 1 - cli-version
  ---
  duration_ms: 8.02
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
# duration_ms 105.050417
TAP version 13
# Subtest: commit-tooling
    # Subtest: scaffoldCommitlint
        # Subtest: returns false when no package.json
        ok 1 - returns false when no package.json
          ---
          duration_ms: 0.925209
          ...
        # Subtest: writes commitlint.config.js, .husky/commit-msg, and updates package.json when skipInstall
        ok 2 - writes commitlint.config.js, .husky/commit-msg, and updates package.json when skipInstall
          ---
          duration_ms: 2.588542
          ...
        1..2
    ok 1 - scaffoldCommitlint
      ---
      duration_ms: 4.105042
      type: 'suite'
      ...
    1..1
ok 1 - commit-tooling
  ---
  duration_ms: 4.862417
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
# duration_ms 138.891458
TAP version 13
# Subtest: config
    # Subtest: readPkg
        # Subtest: returns null when package.json does not exist
        ok 1 - returns null when package.json does not exist
          ---
          duration_ms: 0.809667
          ...
        # Subtest: returns parsed package.json when it exists
        ok 2 - returns parsed package.json when it exists
          ---
          duration_ms: 1.580167
          ...
        1..2
    ok 1 - readPkg
      ---
      duration_ms: 2.710625
      type: 'suite'
      ...
    # Subtest: readConfig
        # Subtest: returns null when no package.json and no climaybe config file
        ok 1 - returns null when no package.json and no climaybe config file
          ---
          duration_ms: 0.329625
          ...
        # Subtest: returns null when package.json has no config key
        ok 2 - returns null when package.json has no config key
          ---
          duration_ms: 0.764834
          ...
        # Subtest: returns climaybe.config.json when present
        ok 3 - returns climaybe.config.json when present
          ---
          duration_ms: 0.562375
          ...
        # Subtest: returns config object when present
        ok 4 - returns config object when present
          ---
          duration_ms: 0.575292
          ...
        1..4
    ok 2 - readConfig
      ---
      duration_ms: 2.830292
      type: 'suite'
      ...
    # Subtest: writeConfig
        # Subtest: creates climaybe.config.json when missing
        ok 1 - creates climaybe.config.json when missing
          ---
          duration_ms: 0.783291
          ...
        # Subtest: merges config into existing climaybe.config.json
        ok 2 - merges config into existing climaybe.config.json
          ---
          duration_ms: 0.697333
          ...
        # Subtest: does not create package.json by default
        ok 3 - does not create package.json by default
          ---
          duration_ms: 0.46275
          ...
        # Subtest: can also write legacy package.json config when enabled
        ok 4 - can also write legacy package.json config when enabled
          ---
          duration_ms: 20.00075
          ...
        1..4
    ok 3 - writeConfig
      ---
      duration_ms: 22.160666
      type: 'suite'
      ...
    # Subtest: migrateLegacyPackageConfigToClimaybe
        # Subtest: writes climaybe.config.json from package.json config when missing
        ok 1 - writes climaybe.config.json from package.json config when missing
          ---
          duration_ms: 1.528167
          ...
        1..1
    ok 4 - migrateLegacyPackageConfigToClimaybe
      ---
      duration_ms: 1.598083
      type: 'suite'
      ...
    # Subtest: getProjectType
        # Subtest: returns theme when project_type missing or theme
        ok 1 - returns theme when project_type missing or theme
          ---
          duration_ms: 1.075917
          ...
        # Subtest: returns app when project_type is app
        ok 2 - returns app when project_type is app
          ---
          duration_ms: 0.548333
          ...
        1..2
    ok 5 - getProjectType
      ---
      duration_ms: 1.824791
      type: 'suite'
      ...
    # Subtest: isThemeProjectForAppInit
        # Subtest: returns false when no config
        ok 1 - returns false when no config
          ---
          duration_ms: 0.216
          ...
        # Subtest: returns true for legacy stores or project_type theme
        ok 2 - returns true for legacy stores or project_type theme
          ---
          duration_ms: 0.815542
          ...
        # Subtest: returns false for app project_type without stores
        ok 3 - returns false for app project_type without stores
          ---
          duration_ms: 0.450417
          ...
        1..3
    ok 6 - isThemeProjectForAppInit
      ---
      duration_ms: 1.6235
      type: 'suite'
      ...
    # Subtest: getStoreAliases
        # Subtest: returns empty array when no config or no stores
        ok 1 - returns empty array when no config or no stores
          ---
          duration_ms: 0.63375
          ...
        # Subtest: returns keys of config.stores
        ok 2 - returns keys of config.stores
          ---
          duration_ms: 0.566167
          ...
        1..2
    ok 7 - getStoreAliases
      ---
      duration_ms: 1.25175
      type: 'suite'
      ...
    # Subtest: getMode
        # Subtest: returns single when one store
        ok 1 - returns single when one store
          ---
          duration_ms: 1.170208
          ...
        # Subtest: returns multi when multiple stores
        ok 2 - returns multi when multiple stores
          ---
          duration_ms: 0.58325
          ...
        1..2
    ok 8 - getMode
      ---
      duration_ms: 1.810166
      type: 'suite'
      ...
    # Subtest: isPreviewWorkflowsEnabled
        # Subtest: returns false when not set or false
        ok 1 - returns false when not set or false
          ---
          duration_ms: 0.900542
          ...
        # Subtest: returns true when preview_workflows is true
        ok 2 - returns true when preview_workflows is true
          ---
          duration_ms: 0.649167
          ...
        1..2
    ok 9 - isPreviewWorkflowsEnabled
      ---
      duration_ms: 1.60675
      type: 'suite'
      ...
    # Subtest: isBuildWorkflowsEnabled
        # Subtest: returns false when not set or false
        ok 1 - returns false when not set or false
          ---
          duration_ms: 0.566
          ...
        # Subtest: returns true when build_workflows is true
        ok 2 - returns true when build_workflows is true
          ---
          duration_ms: 0.522
          ...
        1..2
    ok 10 - isBuildWorkflowsEnabled
      ---
      duration_ms: 1.149458
      type: 'suite'
      ...
    # Subtest: isCommitlintEnabled
        # Subtest: returns false when not set or false
        ok 1 - returns false when not set or false
          ---
          duration_ms: 0.600166
          ...
        # Subtest: returns true when commitlint is true
        ok 2 - returns true when commitlint is true
          ---
          duration_ms: 0.529041
          ...
        1..2
    ok 11 - isCommitlintEnabled
      ---
      duration_ms: 1.257834
      type: 'suite'
      ...
    # Subtest: isCursorSkillsEnabled
        # Subtest: returns false when not set or false
        ok 1 - returns false when not set or false
          ---
          duration_ms: 0.581
          ...
        # Subtest: returns true when cursor_skills is true
        ok 2 - returns true when cursor_skills is true
          ---
          duration_ms: 0.432417
          ...
        1..2
    ok 12 - isCursorSkillsEnabled
      ---
      duration_ms: 1.054
      type: 'suite'
      ...
    # Subtest: addStoreToConfig
        # Subtest: adds store and sets default_store when first
        ok 1 - adds store and sets default_store when first
          ---
          duration_ms: 0.582125
          ...
        # Subtest: adds store without overwriting default_store when not first
        ok 2 - adds store without overwriting default_store when not first
          ---
          duration_ms: 0.754917
          ...
        1..2
    ok 13 - addStoreToConfig
      ---
      duration_ms: 1.384625
      type: 'suite'
      ...
    # Subtest: active_store_alias helpers
        # Subtest: returns null when not set or invalid
        ok 1 - returns null when not set or invalid
          ---
          duration_ms: 0.579292
          ...
        # Subtest: persists and reads a valid active alias
        ok 2 - persists and reads a valid active alias
          ---
          duration_ms: 0.909958
          ...
        1..2
    ok 14 - active_store_alias helpers
      ---
      duration_ms: 1.5435
      type: 'suite'
      ...
    1..14
ok 1 - config
  ---
  duration_ms: 44.8865
  type: 'suite'
  ...
1..1
# tests 32
# suites 15
# pass 32
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 142.054583
TAP version 13
# Subtest: cursor-bundle
    # Subtest: copies rules, skills, and agents including theme-translator
    ok 1 - copies rules, skills, and agents including theme-translator
      ---
      duration_ms: 20.566083
      ...
    1..1
ok 1 - cursor-bundle
  ---
  duration_ms: 22.358042
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
# duration_ms 102.92725
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
          duration_ms: 26.326708
          ...
        # Subtest: returns true after git init
        ok 2 - returns true after git init
          ---
          duration_ms: 56.324583
          ...
        1..2
    ok 1 - isGitRepo
      ---
      duration_ms: 83.197834
      type: 'suite'
      ...
    # Subtest: currentBranch
        # Subtest: returns branch name in repo with commit
        ok 1 - returns branch name in repo with commit
          ---
          duration_ms: 166.365375
          ...
        1..1
    ok 2 - currentBranch
      ---
      duration_ms: 166.450125
      type: 'suite'
      ...
    # Subtest: branchExists
        # Subtest: returns false for non-existent branch
        ok 1 - returns false for non-existent branch
          ---
          duration_ms: 160.32975
          ...
        # Subtest: returns true after creating branch
        ok 2 - returns true after creating branch
          ---
          duration_ms: 146.397708
          ...
        1..2
    ok 3 - branchExists
      ---
      duration_ms: 307.242958
      type: 'suite'
      ...
    # Subtest: createBranch
        # Subtest: creates branch and returns true
        ok 1 - creates branch and returns true
          ---
          duration_ms: 170.4795
          ...
        # Subtest: skips and returns false when branch already exists
        ok 2 - skips and returns false when branch already exists
          ---
          duration_ms: 149.676
          ...
        1..2
    ok 4 - createBranch
      ---
      duration_ms: 320.751292
      type: 'suite'
      ...
    # Subtest: createStoreBranches
        # Subtest: creates staging-<alias> and live-<alias>
        ok 1 - creates staging-<alias> and live-<alias>
          ---
          duration_ms: 216.445416
          ...
        1..1
    ok 5 - createStoreBranches
      ---
      duration_ms: 216.522167
      type: 'suite'
      ...
    # Subtest: ensureStagingBranch
        # Subtest: creates staging branch
        ok 1 - creates staging branch
          ---
          duration_ms: 161.520417
          ...
        1..1
    ok 6 - ensureStagingBranch
      ---
      duration_ms: 161.606417
      type: 'suite'
      ...
    # Subtest: ensureInitialCommit
        # Subtest: creates initial commit when repo has none
        ok 1 - creates initial commit when repo has none
          ---
          duration_ms: 132.147417
          ...
        # Subtest: does not error when commit already exists
        ok 2 - does not error when commit already exists
          ---
          duration_ms: 123.195083
          ...
        1..2
    ok 7 - ensureInitialCommit
      ---
      duration_ms: 255.728959
      type: 'suite'
      ...
    # Subtest: ensureGitRepo
        # Subtest: runs git init when not a repo
        ok 1 - runs git init when not a repo
          ---
          duration_ms: 57.8205
          ...
        # Subtest: does not error when already a repo
        ok 2 - does not error when already a repo
          ---
          duration_ms: 91.948167
          ...
        1..2
    ok 8 - ensureGitRepo
      ---
      duration_ms: 149.997666
      type: 'suite'
      ...
    # Subtest: getLatestTagVersion
        # Subtest: returns null in non-git directory
        ok 1 - returns null in non-git directory
          ---
          duration_ms: 18.889375
          ...
        # Subtest: returns null when repo has no v* tags
        ok 2 - returns null when repo has no v* tags
          ---
          duration_ms: 148.945
          ...
        # Subtest: returns latest version from v* tags (semver sorted)
        ok 3 - returns latest version from v* tags (semver sorted)
          ---
          duration_ms: 187.165041
          ...
        1..3
    ok 9 - getLatestTagVersion
      ---
      duration_ms: 355.111875
      type: 'suite'
      ...
    # Subtest: getSuggestedTagForRelease
        # Subtest: returns v1.0.0 when no tags
        ok 1 - returns v1.0.0 when no tags
          ---
          duration_ms: 144.529958
          ...
        # Subtest: returns next patch when latest tag exists
        ok 2 - returns next patch when latest tag exists
          ---
          duration_ms: 157.672541
          ...
        1..2
    ok 10 - getSuggestedTagForRelease
      ---
      duration_ms: 302.285292
      type: 'suite'
      ...
    1..10
ok 1 - git
  ---
  duration_ms: 2320.859917
  type: 'suite'
  ...
1..1
# tests 18
# suites 11
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2406.253208
TAP version 13
# Subtest: github-secrets prompting behavior
    # Subtest: marks all single-store init prompts as optional
    ok 1 - marks all single-store init prompts as optional
      ---
      duration_ms: 0.298708
      ...
    # Subtest: marks all multi-store init prompts as optional
    ok 2 - marks all multi-store init prompts as optional
      ---
      duration_ms: 0.09375
      ...
    # Subtest: marks add-store prompts as optional
    ok 3 - marks add-store prompts as optional
      ---
      duration_ms: 0.627917
      ...
    1..3
ok 1 - github-secrets prompting behavior
  ---
  duration_ms: 1.766292
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
# duration_ms 62.200291
TAP version 13
# Subtest: prompts (pure helpers)
    # Subtest: extractAlias
        # Subtest: strips .myshopify.com suffix
        ok 1 - strips .myshopify.com suffix
          ---
          duration_ms: 0.211792
          ...
        # Subtest: is case-insensitive for suffix
        ok 2 - is case-insensitive for suffix
          ---
          duration_ms: 0.038
          ...
        # Subtest: trims whitespace
        ok 3 - trims whitespace
          ---
          duration_ms: 0.036875
          ...
        1..3
    ok 1 - extractAlias
      ---
      duration_ms: 0.608917
      type: 'suite'
      ...
    # Subtest: normalizeDomain
        # Subtest: appends .myshopify.com when missing
        ok 1 - appends .myshopify.com when missing
          ---
          duration_ms: 0.268583
          ...
        # Subtest: leaves domain unchanged when already .myshopify.com
        ok 2 - leaves domain unchanged when already .myshopify.com
          ---
          duration_ms: 0.035667
          ...
        # Subtest: strips protocol and path
        ok 3 - strips protocol and path
          ---
          duration_ms: 0.038084
          ...
        # Subtest: lowercases result
        ok 4 - lowercases result
          ---
          duration_ms: 0.046333
          ...
        # Subtest: trims and collapses spaces
        ok 5 - trims and collapses spaces
          ---
          duration_ms: 0.038375
          ...
        # Subtest: returns empty string for empty input
        ok 6 - returns empty string for empty input
          ---
          duration_ms: 0.038125
          ...
        1..6
    ok 2 - normalizeDomain
      ---
      duration_ms: 0.726208
      type: 'suite'
      ...
    # Subtest: isValidShopifyDomain
        # Subtest: accepts valid subdomain.myshopify.com
        ok 1 - accepts valid subdomain.myshopify.com
          ---
          duration_ms: 0.185542
          ...
        # Subtest: rejects missing or wrong suffix
        ok 2 - rejects missing or wrong suffix
          ---
          duration_ms: 0.035083
          ...
        # Subtest: rejects leading hyphen or invalid chars in subdomain
        ok 3 - rejects leading hyphen or invalid chars in subdomain
          ---
          duration_ms: 0.035042
          ...
        # Subtest: rejects empty
        ok 4 - rejects empty
          ---
          duration_ms: 0.1555
          ...
        1..4
    ok 3 - isValidShopifyDomain
      ---
      duration_ms: 0.467459
      type: 'suite'
      ...
    # Subtest: promptStoreAliasSelection
        # Subtest: returns selected alias
        ok 1 - returns selected alias
          ---
          duration_ms: 0.19975
          ...
        1..1
    ok 4 - promptStoreAliasSelection
      ---
      duration_ms: 0.235709
      type: 'suite'
      ...
    1..4
ok 1 - prompts (pure helpers)
  ---
  duration_ms: 2.711375
  type: 'suite'
  ...
1..1
# tests 14
# suites 5
# pass 14
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 78.553167
TAP version 13
# file:///Users/efe/dev/17_ops/17.01%20Internal%20Tools/climaybe/tests/lib/serve-store.test.js:1
# TAP version 13
#     ^^^^^^^
# SyntaxError: Unexpected identifier
#     at ESMLoader.moduleStrategy (node:internal/modules/esm/translators:119:18)
#     at ESMLoader.moduleProvider (node:internal/modules/esm/loader:468:14)
#     at async link (node:internal/modules/esm/module_job:68:21)
# Node.js v18.18.0
# Subtest: /Users/efe/dev/17_ops/17.01 Internal Tools/climaybe/tests/lib/serve-store.test.js
not ok 1 - /Users/efe/dev/17_ops/17.01 Internal Tools/climaybe/tests/lib/serve-store.test.js
  ---
  duration_ms: 40.04275
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
# duration_ms 43.296125
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
          duration_ms: 3.599333
          ...
        1..1
    ok 1 - createStoreDirectories
      ---
      duration_ms: 3.988417
      type: 'suite'
      ...
    # Subtest: storesToRoot
        # Subtest: returns false when store dir does not exist
        ok 1 - returns false when store dir does not exist
          ---
          duration_ms: 0.602041
          ...
        # Subtest: copies JSON from stores/<alias>/ sync dirs to root
        ok 2 - copies JSON from stores/<alias>/ sync dirs to root
          ---
          duration_ms: 3.760708
          ...
        1..2
    ok 2 - storesToRoot
      ---
      duration_ms: 4.587584
      type: 'suite'
      ...
    # Subtest: rootToStores
        # Subtest: copies JSON from root sync dirs to stores/<alias>/
        ok 1 - copies JSON from root sync dirs to stores/<alias>/
          ---
          duration_ms: 6.090667
          ...
        1..1
    ok 3 - rootToStores
      ---
      duration_ms: 6.257958
      type: 'suite'
      ...
    1..3
ok 1 - store-sync
  ---
  duration_ms: 15.70025
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
# duration_ms 113.284459
TAP version 13
# Subtest: theme-dev-kit
    # Subtest: scaffolds dev kit files, writes climaybe.config.json, and adds climaybe + tailwindcss deps
    ok 1 - scaffolds dev kit files, writes climaybe.config.json, and adds climaybe + tailwindcss deps
      ---
      duration_ms: 5.1745
      ...
    # Subtest: detects existing files that will be replaced
    ok 2 - detects existing files that will be replaced
      ---
      duration_ms: 1.446083
      ...
    # Subtest: updates existing managed gitignore block on rerun
    ok 3 - updates existing managed gitignore block on rerun
      ---
      duration_ms: 2.584041
      ...
    1..3
ok 1 - theme-dev-kit
  ---
  duration_ms: 10.223125
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
# duration_ms 99.36075
TAP version 13
#   This command is for theme repos only. This project has project_type: app.
#   Use climaybe app init for app setup; theme stores and workflows do not apply here.
# Subtest: theme-guard
    # Subtest: returns true for theme project
    ok 1 - returns true for theme project
      ---
      duration_ms: 1.52825
      ...
    # Subtest: returns false for app project
    ok 2 - returns false for app project
      ---
      duration_ms: 1.006625
      ...
    1..2
ok 1 - theme-guard
  ---
  duration_ms: 3.366542
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
# duration_ms 66.851458
TAP version 13
# Subtest: update-notifier
    # Subtest: isVersionGreater
        # Subtest: returns true when candidate is newer
        ok 1 - returns true when candidate is newer
          ---
          duration_ms: 0.256792
          ...
        # Subtest: returns false when versions are equal or older
        ok 2 - returns false when versions are equal or older
          ---
          duration_ms: 0.052666
          ...
        # Subtest: handles optional v prefix and pre-release metadata
        ok 3 - handles optional v prefix and pre-release metadata
          ---
          duration_ms: 0.042459
          ...
        # Subtest: returns false for invalid versions
        ok 4 - returns false for invalid versions
          ---
          duration_ms: 0.043459
          ...
        1..4
    ok 1 - isVersionGreater
      ---
      duration_ms: 0.74175
      type: 'suite'
      ...
    # Subtest: resolveInstallScope
        # Subtest: prefers local when package.json exists in cwd
        ok 1 - prefers local when package.json exists in cwd
          ---
          duration_ms: 173.339417
          ...
        # Subtest: falls back to global when local project does not exist
        ok 2 - falls back to global when local project does not exist
          ---
          duration_ms: 117.402791
          ...
        1..2
    ok 2 - resolveInstallScope
      ---
      duration_ms: 290.94575
      type: 'suite'
      ...
    # Subtest: local install policy
        # Subtest: always installs climaybe in dependencies for local updates
        ok 1 - always installs climaybe in dependencies for local updates
          ---
          duration_ms: 0.953625
          ...
        1..1
    ok 3 - local install policy
      ---
      duration_ms: 1.0315
      type: 'suite'
      ...
    1..3
ok 1 - update-notifier
  ---
  duration_ms: 293.250166
  type: 'suite'
  ...
1..1
# tests 7
# suites 4
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 366.925917
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
#   Scaffolded 5 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: disabled
#   Build workflows: disabled
#   Scaffolded 12 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: enabled
#   Build workflows: disabled
#   Scaffolded 8 workflow(s) → .github/workflows/
#   Mode: single-store
#   Preview workflows: disabled
#   Build workflows: enabled
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
          duration_ms: 4.350833
          ...
        # Subtest: includes multi workflows when mode is multi
        ok 2 - includes multi workflows when mode is multi
          ---
          duration_ms: 5.325583
          ...
        # Subtest: keeps live hotfixes eligible for same-store staging sync
        ok 3 - keeps live hotfixes eligible for same-store staging sync
          ---
          duration_ms: 3.956541
          ...
        # Subtest: skips no-op main-to-staging sync when trees are identical
        ok 4 - skips no-op main-to-staging sync when trees are identical
          ---
          duration_ms: 4.886875
          ...
        # Subtest: skips no-op hotfix backports when source and main trees match
        ok 5 - skips no-op hotfix backports when source and main trees match
          ---
          duration_ms: 4.10925
          ...
        # Subtest: keeps live minified assets out of main hotfix backports
        ok 6 - keeps live minified assets out of main hotfix backports
          ---
          duration_ms: 3.822833
          ...
        # Subtest: ignores no-op commits in nightly hotfix tagging
        ok 7 - ignores no-op commits in nightly hotfix tagging
          ---
          duration_ms: 2.609041
          ...
        # Subtest: includes preview workflows when includePreview is true
        ok 8 - includes preview workflows when includePreview is true
          ---
          duration_ms: 5.13125
          ...
        # Subtest: includes build workflows when includeBuild is true
        ok 9 - includes build workflows when includeBuild is true
          ---
          duration_ms: 3.619166
          ...
        # Subtest: wires create-release to tagging workflow completion
        ok 10 - wires create-release to tagging workflow completion
          ---
          duration_ms: 3.660458
          ...
        # Subtest: does not install per-repo build script shims
        ok 11 - does not install per-repo build script shims
          ---
          duration_ms: 4.927083
          ...
        # Subtest: overwrites existing workflows on second scaffold
        ok 12 - overwrites existing workflows on second scaffold
          ---
          duration_ms: 3.751709
          ...
        1..12
    ok 1 - scaffoldWorkflows
      ---
      duration_ms: 50.715208
      type: 'suite'
      ...
    1..1
ok 1 - workflows
  ---
  duration_ms: 51.213584
  type: 'suite'
  ...
1..1
# tests 12
# suites 2
# pass 12
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 114.464292
TAP version 13
# Subtest: build-scripts
    # Subtest: inlines imported files and strips ESM import syntax from output bundle
    ok 1 - inlines imported files and strips ESM import syntax from output bundle
      ---
      duration_ms: 5.814
      ...
    # Subtest: strips common ESM export syntax from output bundle
    ok 2 - strips common ESM export syntax from output bundle
      ---
      duration_ms: 1.956416
      ...
    # Subtest: strips multiline named imports from main.js style headers
    ok 3 - strips multiline named imports from main.js style headers
      ---
      duration_ms: 2.360917
      ...
    # Subtest: strips compact imports and import attributes from output bundle
    ok 4 - strips compact imports and import attributes from output bundle
      ---
      duration_ms: 1.973125
      ...
    # Subtest: strips bare side-effect import lines without semicolon from main.js
    ok 5 - strips bare side-effect import lines without semicolon from main.js
      ---
      duration_ms: 1.524042
      ...
    # Subtest: builds additional top-level entrypoints to separate asset files
    ok 6 - builds additional top-level entrypoints to separate asset files
      ---
      duration_ms: 1.571792
      ...
    # Subtest: does not emit separate bundles for files imported by main.js
    ok 7 - does not emit separate bundles for files imported by main.js
      ---
      duration_ms: 2.703584
      ...
    # Subtest: does not emit separate bundles for files imported by another top-level entrypoint
    ok 8 - does not emit separate bundles for files imported by another top-level entrypoint
      ---
      duration_ms: 1.914542
      ...
    # Subtest: preserves script comments in production mode
    ok 9 - preserves script comments in production mode
      ---
      duration_ms: 1.27175
      ...
    # Subtest: minifies output only when minify option is enabled
    ok 10 - minifies output only when minify option is enabled
      ---
      duration_ms: 1.252708
      ...
    1..10
ok 1 - build-scripts
  ---
  duration_ms: 23.194709
  type: 'suite'
  ...
1..1
# tests 10
# suites 1
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 80.827958
