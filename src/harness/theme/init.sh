#!/usr/bin/env bash
# climaybe theme harness — standard startup + verification
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

SKIP_INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP_INSTALL=1 ;;
  esac
done

banner() {
  echo ""
  echo "=== climaybe harness: {{THEME_NAME}} ==="
  echo ""
}

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: Node.js is required (need >= 22.12 for Shopify CLI 4.8.5)." >&2
    exit 1
  fi
  # Portable major.minor parse (works on Node 20+)
  local ver major minor
  ver="$(node -p "process.versions.node")"
  major="${ver%%.*}"
  minor="${ver#*.}"
  minor="${minor%%.*}"
  if [ "$major" -lt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -lt 12 ]; }; then
    echo "ERROR: Node.js >= 22.12 required (found v${ver}). Shopify CLI 4.8.5 needs this floor." >&2
    exit 1
  fi
  echo "Node v${ver} OK"
}

warn_git() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "WARNING: not a git repository (continuing)."
  fi
}

run_npm_install() {
  if [ ! -f package.json ]; then
    echo "SKIP: no package.json — npm install/ci and npm test steps skipped."
    return 0
  fi
  if [ "$SKIP_INSTALL" -eq 1 ]; then
    echo "SKIP: --skip-install"
    return 0
  fi
  if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
    echo "=== npm ci ==="
    npm ci
  else
    echo "=== npm install ==="
    npm install
  fi
}

run_climaybe_check() {
  echo "=== climaybe check ==="
  if command -v npx >/dev/null 2>&1; then
    npx --yes climaybe check
  else
    echo "ERROR: npx not found; cannot run climaybe check." >&2
    exit 1
  fi
}

discover_unit_tests() {
  # Portable discovery for Node 20+ (no Node-21-only globs).
  node -e "
const fs = require('fs');
const path = require('path');
const out = [];
function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\\.test\\.(js|mjs)\$/.test(e.name)) out.push(p);
  }
}
if (fs.existsSync('tests')) walk('tests');
process.stdout.write(out.join('\\n'));
"
}

run_unit_tests() {
  if [ ! -f package.json ]; then
    echo "SKIP: no package.json — unit tests not run."
    return 0
  fi
  if node -e "const s=require('./package.json').scripts||{}; process.exit(s.test?0:1)"; then
    echo "=== npm test ==="
    npm test
    return 0
  fi
  local files
  files="$(discover_unit_tests || true)"
  if [ -n "${files}" ]; then
    echo "=== node --test (discovered tests/**/*.test.{js,mjs}) ==="
    # shellcheck disable=SC2086
    node --test ${files}
    return 0
  fi
  echo "no unit tests found"
}

banner
require_node
warn_git
run_npm_install
run_climaybe_check
run_unit_tests

echo ""
echo "=== Verification complete ==="
echo "Next: read feature_list.json, pick ONE unfinished feature, implement it, then re-run ./init.sh before claiming done."
