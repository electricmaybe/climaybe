#!/usr/bin/env bash
# climaybe theme harness — standard startup + verification (token-cheap by default)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

SKIP_INSTALL=0
VERBOSE=0
for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP_INSTALL=1 ;;
    --verbose|-v) VERBOSE=1 ;;
  esac
done

LOCK_STAMP="node_modules/.init-lock-hash"
FAIL_TAIL_LINES=40
FAIL_HEAD_LINES=50

log() { echo "$*"; }

fail_tail() {
  local log_path="$1"
  local n="$FAIL_TAIL_LINES"
  local total
  total="$(wc -l <"$log_path" | tr -d ' ')"
  if [ "$total" -gt "$n" ]; then
    echo "... $((total - n)) earlier lines omitted"
  fi
  tail -n "$n" "$log_path" || true
  echo "full output: $log_path"
}

fail_head() {
  local log_path="$1"
  local n="$FAIL_HEAD_LINES"
  local total
  total="$(wc -l <"$log_path" | tr -d ' ')"
  head -n "$n" "$log_path" || true
  if [ "$total" -gt "$n" ]; then
    echo "... $((total - n)) more, full output: $log_path"
  else
    echo "full output: $log_path"
  fi
}

file_sha256() {
  node -e "const fs=require('fs');const c=require('crypto');process.stdout.write(c.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'))" "$1"
}

lockfile_path() {
  if [ -f package-lock.json ]; then
    echo package-lock.json
  elif [ -f npm-shrinkwrap.json ]; then
    echo npm-shrinkwrap.json
  elif [ -f package.json ]; then
    echo package.json
  else
    echo ""
  fi
}

install_up_to_date() {
  local lock
  lock="$(lockfile_path)"
  [ -n "$lock" ] || return 1
  [ -d node_modules ] || return 1
  [ -f "$LOCK_STAMP" ] || return 1
  local want have
  want="$(file_sha256 "$lock")"
  have="$(tr -d '[:space:]' <"$LOCK_STAMP" || true)"
  [ -n "$want" ] && [ "$want" = "$have" ]
}

write_lock_stamp() {
  local lock
  lock="$(lockfile_path)"
  [ -n "$lock" ] || return 0
  mkdir -p node_modules
  file_sha256 "$lock" >"$LOCK_STAMP"
}

banner() {
  log "=== climaybe harness: {{THEME_NAME}} ==="
}

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: Node.js is required (need >= 22.12 for Shopify CLI 4.8.5)." >&2
    exit 1
  fi
  local ver major minor
  ver="$(node -p "process.versions.node")"
  major="${ver%%.*}"
  minor="${ver#*.}"
  minor="${minor%%.*}"
  if [ "$major" -lt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -lt 12 ]; }; then
    echo "ERROR: Node.js >= 22.12 required (found v${ver}). Shopify CLI 4.8.5 needs this floor." >&2
    exit 1
  fi
  log "node: v${ver}"
}

warn_git() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log "git: not a repository (continuing)"
  fi
}

run_npm_install() {
  if [ ! -f package.json ]; then
    log "install: SKIP (no package.json)"
    return 0
  fi
  if [ "$SKIP_INSTALL" -eq 1 ]; then
    log "install: SKIP (--skip-install)"
    return 0
  fi
  if install_up_to_date; then
    log "install: up to date (skipped)"
    return 0
  fi

  local cmd log_path code
  if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
    cmd=(npm ci --no-audit --no-fund --loglevel=error)
  else
    cmd=(npm install --no-audit --no-fund --loglevel=error)
  fi

  if [ "$VERBOSE" -eq 1 ]; then
    "${cmd[@]}"
    write_lock_stamp
    log "install: ok"
    return 0
  fi

  log_path="$(mktemp "${TMPDIR:-/tmp}/climaybe-init-install.XXXXXX")"
  set +e
  "${cmd[@]}" >"$log_path" 2>&1
  code=$?
  set -e
  if [ "$code" -eq 0 ]; then
    write_lock_stamp
    rm -f "$log_path"
    log "install: ok"
    return 0
  fi
  log "install: FAILED"
  fail_tail "$log_path"
  exit "$code"
}

run_climaybe_check() {
  if ! command -v npx >/dev/null 2>&1; then
    echo "ERROR: npx not found; cannot run climaybe check." >&2
    exit 1
  fi

  local log_path code
  if [ "$VERBOSE" -eq 1 ]; then
    npx --yes climaybe check
    return 0
  fi

  log_path="$(mktemp "${TMPDIR:-/tmp}/climaybe-init-check.XXXXXX")"
  set +e
  npx --yes climaybe check --quiet >"$log_path" 2>&1
  code=$?
  set -e
  if [ "$code" -eq 0 ]; then
    # Prefer the quiet summary line from climaybe check.
    if grep -q '^theme check:' "$log_path" 2>/dev/null; then
      grep '^theme check:' "$log_path" | head -n 1
    else
      log "theme check: ok"
    fi
    rm -f "$log_path"
    return 0
  fi
  log "theme check: FAILED"
  fail_head "$log_path"
  exit "$code"
}

discover_unit_tests() {
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

parse_tests_passed() {
  local log_path="$1"
  # Prefer node:test TAP summary, then common Jest/Vitest phrasing.
  local n
  n="$(grep -E '^# pass [0-9]+' "$log_path" | tail -n 1 | awk '{print $3}' || true)"
  if [ -n "${n:-}" ]; then
    echo "$n"
    return 0
  fi
  n="$(grep -Eih '([0-9]+) passed' "$log_path" | tail -n 1 | sed -E 's/.*[^0-9]([0-9]+) passed.*/\1/' || true)"
  if [ -n "${n:-}" ] && [[ "$n" =~ ^[0-9]+$ ]]; then
    echo "$n"
    return 0
  fi
  echo ""
}

run_unit_tests() {
  if [ ! -f package.json ]; then
    log "tests: SKIP (no package.json)"
    return 0
  fi

  local mode="" cmd=()
  if node -e "const s=require('./package.json').scripts||{}; process.exit(s.test?0:1)"; then
    mode="npm"
    cmd=(npm test --silent)
  else
    local files
    files="$(discover_unit_tests || true)"
    if [ -n "${files}" ]; then
      mode="node"
      # shellcheck disable=SC2206
      cmd=(node --test ${files})
    else
      log "tests: none"
      return 0
    fi
  fi

  if [ "$VERBOSE" -eq 1 ]; then
    "${cmd[@]}"
    return 0
  fi

  local log_path code passed
  log_path="$(mktemp "${TMPDIR:-/tmp}/climaybe-init-tests.XXXXXX")"
  set +e
  "${cmd[@]}" >"$log_path" 2>&1
  code=$?
  set -e
  if [ "$code" -eq 0 ]; then
    passed="$(parse_tests_passed "$log_path")"
    if [ -n "$passed" ]; then
      log "tests: ${passed} passed"
    else
      log "tests: ok"
    fi
    rm -f "$log_path"
    return 0
  fi
  log "tests: FAILED"
  fail_head "$log_path"
  exit "$code"
}

banner
require_node
warn_git
run_npm_install
run_climaybe_check
run_unit_tests
log "ok — next: one feature from feature_list.json, then re-run ./init.sh before claiming done"
