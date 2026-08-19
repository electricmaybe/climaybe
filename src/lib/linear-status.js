/**
 * Linear issue-status mapping for climaybe store-branch hops.
 * Status names are overridable via climaybe.config.json → linear_statuses.
 * The `store` value is a literal Linear state name (angle brackets included),
 * not interpolated with a store alias.
 */

export const DEFAULT_LINEAR_STATUSES = {
  staging: 'Staged @staging',
  store: 'Staged @staging-<alias>',
  live: 'Done',
};

/** Forward-only buckets: staging < store < live. */
export const LINEAR_STATUS_RANK = {
  staging: 0,
  store: 1,
  live: 2,
};

export const LINEAR_ISSUE_ID_RE = /\b[A-Z]{2,10}-\d+\b/g;

const LOOP_COMMIT_MARKERS = ['[skip-store-sync]', '[stores-to-root]', '[root-to-stores]', '[hotfix-backport]'];

/**
 * Normalize a Linear team key (e.g. vol → VOL). Empty string if unset.
 * Returns null when the value is present but invalid.
 * @param {unknown} input
 * @returns {string | null}
 */
export function normalizeLinearTeamKey(input) {
  const value = String(input ?? '').trim().toUpperCase();
  if (!value) return '';
  if (!/^[A-Z]{2,10}$/.test(value)) return null;
  return value;
}

/**
 * Resolve status names from config, filling defaults for any missing key.
 * @param {object} [config]
 */
export function resolveLinearStatuses(config = {}) {
  const raw = config?.linear_statuses && typeof config.linear_statuses === 'object' ? config.linear_statuses : {};
  const pick = (key) => {
    const value = raw[key];
    return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_LINEAR_STATUSES[key];
  };
  return {
    staging: pick('staging'),
    store: pick('store'),
    live: pick('live'),
  };
}

/**
 * Multi-store when climaybe.config.json has more than one store (same as other workflows).
 * @param {object} [config]
 */
export function isMultiStoreConfig(config = {}) {
  const stores = config?.stores;
  if (!stores || typeof stores !== 'object' || Array.isArray(stores)) return false;
  return Object.keys(stores).length > 1;
}

/**
 * Map a git branch name to a Linear status bucket.
 * @param {string} branchName
 * @param {{ multi?: boolean }} [options]
 * @returns {'staging' | 'store' | 'live' | null}
 */
export function resolveLinearStatusBucket(branchName, { multi = false } = {}) {
  const branch = String(branchName || '').trim();
  if (!branch) return null;
  if (branch === 'staging') return 'staging';
  if (branch.startsWith('live-')) return 'live';
  if (branch.startsWith('staging-')) return 'store';
  if (branch === 'main') return multi ? 'store' : 'live';
  return null;
}

/**
 * Map a git branch name to the Linear workflow state name for this repo.
 * @param {string} branchName
 * @param {object} [config]
 * @returns {string | null}
 */
export function resolveLinearStatusName(branchName, config = {}) {
  const bucket = resolveLinearStatusBucket(branchName, { multi: isMultiStoreConfig(config) });
  if (!bucket) return null;
  return resolveLinearStatuses(config)[bucket];
}

/**
 * Rank of a Linear state name against configured bucket names. Unknown → -1.
 * @param {string} statusName
 * @param {{ staging: string, store: string, live: string }} statuses
 */
export function rankForStatusName(statusName, statuses) {
  const name = String(statusName || '');
  if (name && name === statuses.live) return LINEAR_STATUS_RANK.live;
  if (name && name === statuses.store) return LINEAR_STATUS_RANK.store;
  if (name && name === statuses.staging) return LINEAR_STATUS_RANK.staging;
  return -1;
}

/**
 * Whether an issue should move from currentName to targetName.
 * Never moves backward (Done must not return to Staged). Same state is a no-op.
 * Unknown current states (e.g. In Progress) may move to any configured target.
 * @param {string} currentName
 * @param {string} targetName
 * @param {{ staging: string, store: string, live: string }} statuses
 */
export function shouldUpdateLinearState(currentName, targetName, statuses) {
  if (!targetName) return false;
  if (currentName === targetName) return false;
  const targetRank = rankForStatusName(targetName, statuses);
  if (targetRank < 0) return false;
  const currentRank = rankForStatusName(currentName, statuses);
  if (currentRank < 0) return true;
  return targetRank > currentRank;
}

/**
 * Collect unique Linear issue IDs (e.g. VOL-77) from commit subjects/bodies and PR titles.
 * When teamKey is set, only IDs for that team are returned.
 * @param {string} text
 * @param {{ teamKey?: string }} [options]
 * @returns {string[]}
 */
export function extractLinearIssueIds(text, { teamKey } = {}) {
  const matches = String(text || '').match(LINEAR_ISSUE_ID_RE) || [];
  const unique = [];
  const seen = new Set();
  for (const id of matches) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  const normalizedTeam = normalizeLinearTeamKey(teamKey);
  if (!normalizedTeam) return unique;
  const prefix = `${normalizedTeam}-`;
  return unique.filter((id) => id.startsWith(prefix));
}

/**
 * True when this commit is a climaybe automation hop that should not re-trigger Linear sync.
 * @param {string} message
 */
export function isClimaybeLoopCommit(message) {
  const msg = String(message || '');
  if (LOOP_COMMIT_MARKERS.some((marker) => msg.includes(marker))) return true;
  return /chore\(release\)/.test(msg);
}
