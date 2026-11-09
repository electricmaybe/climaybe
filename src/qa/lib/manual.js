import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYamlLite } from './yaml-lite.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED_MANUAL_PATH = join(__dirname, '..', 'manual-shared.yml');

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   expected?: string,
 *   devices?: string[],
 *   when?: string[],
 *   required_on?: Array<'small' | 'medium' | 'release'>,
 *   source?: 'shared' | 'project'
 * }} ManualItem
 */

/**
 * @param {string} [path]
 * @returns {{ version?: number, items: ManualItem[] }}
 */
export function loadManualFile(path) {
  if (!path || !existsSync(path)) return { items: [] };
  const raw = readFileSync(path, 'utf-8');
  const parsed = parseYamlLite(raw);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return {
    version: parsed?.version,
    items: items
      .filter((it) => it && typeof it === 'object' && it.id && it.title)
      .map((it) => ({
        id: String(it.id),
        title: String(it.title),
        expected: it.expected != null ? String(it.expected) : undefined,
        devices: Array.isArray(it.devices) ? it.devices.map(String) : [],
        when: Array.isArray(it.when) ? it.when.map(String) : [],
        required_on: Array.isArray(it.required_on) ? it.required_on.map(String) : [],
      })),
  };
}

/**
 * Load climaybe shared manual checklist.
 */
export function loadSharedManual(path = SHARED_MANUAL_PATH) {
  const doc = loadManualFile(path);
  return {
    ...doc,
    items: doc.items.map((it) => ({ ...it, source: /** @type {const} */ ('shared') })),
  };
}

/**
 * Merge shared + project manuals. Project items with the same id override shared.
 * @param {ManualItem[]} shared
 * @param {ManualItem[]} project
 * @returns {ManualItem[]}
 */
export function mergeManualLists(shared, project) {
  const map = new Map();
  for (const item of shared || []) {
    map.set(item.id, { ...item, source: item.source || 'shared' });
  }
  for (const item of project || []) {
    map.set(item.id, { ...item, source: 'project' });
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Select manual items relevant to the diff / scope.
 * @param {ManualItem[]} items
 * @param {{
 *   scope?: 'small' | 'medium' | 'release',
 *   tags?: string[],
 *   manualIds?: string[],
 *   matchedRuleAreas?: string[],
 * }} selection
 */
export function selectManualItems(items, selection = {}) {
  const scope = selection.scope || 'small';
  const tags = new Set((selection.tags || []).map((t) => t.replace(/^@/, '')));
  const explicitIds = new Set(selection.manualIds || []);
  const areas = new Set([
    ...tags,
    ...(selection.matchedRuleAreas || []),
  ]);

  if (scope === 'release') {
    // Release: all items that are required_on release, or have empty when (always), or match.
    return (items || []).filter((item) => {
      if (explicitIds.has(item.id)) return true;
      const req = item.required_on || [];
      if (req.includes('release') || req.length === 0) return true;
      return itemMatchesAreas(item, areas);
    });
  }

  return (items || []).filter((item) => {
    if (explicitIds.has(item.id)) return true;
    const req = item.required_on || [];
    if (req.includes(scope) && itemMatchesAreas(item, areas)) return true;
    if (req.includes(scope) && (item.when || []).length === 0) return true;
    return itemMatchesAreas(item, areas);
  });
}

/**
 * @param {ManualItem} item
 * @param {Set<string>} areas
 */
function itemMatchesAreas(item, areas) {
  const when = item.when || [];
  if (when.length === 0) return areas.size === 0;
  return when.some((w) => areas.has(w) || areas.has(w.replace(/^@/, '')));
}

/**
 * Render a GitHub task-list comment body.
 * @param {ManualItem[]} items
 * @param {{ headSha?: string, scope?: string, previewUrl?: string }} meta
 */
export function renderManualChecklistComment(items, meta = {}) {
  const marker = '<!-- climaybe-qa-manual -->';
  const lines = [
    marker,
    `<!-- climaybe-qa-manual-sha:${meta.headSha || ''} -->`,
    '## Store QA — manual checklist',
    '',
    meta.scope ? `Scope: **${meta.scope}**` : null,
    meta.previewUrl ? `Preview: ${meta.previewUrl}` : null,
    meta.headSha ? `Head: \`${meta.headSha}\`` : null,
    '',
    'Tick every box when done. The `qa-manual` check stays pending until all are checked.',
    '',
  ].filter((l) => l != null);

  if (!items.length) {
    lines.push('_No manual items selected for this diff._');
    lines.push('');
    lines.push('- [x] No manual checks required');
  } else {
    for (const item of items) {
      const devices = (item.devices || []).length ? ` (${item.devices.join(', ')})` : '';
      lines.push(`- [ ] **${item.id}**${devices}: ${item.title}`);
      if (item.expected) lines.push(`  - Expected: ${item.expected}`);
    }
  }

  lines.push('');
  lines.push('_Updated in place by climaybe store QA._');
  return lines.join('\n');
}

/**
 * Parse checklist completion from a PR comment body.
 * @param {string} body
 * @returns {{ complete: boolean, total: number, checked: number, uncheckedIds: string[] }}
 */
export function parseManualChecklistProgress(body) {
  const text = String(body || '');
  const uncheckedIds = [];
  let total = 0;
  let checked = 0;

  const uncheckedRe = /^- \[ \] \*\*([^*]+)\*\*/gm;
  const checkedRe = /^- \[x\] \*\*([^*]+)\*\*/gim;
  const uncheckedAny = /^- \[ \] /gm;
  const checkedAny = /^- \[x\] /gim;

  // Prefer id-bearing items; fall back to any task list
  let m;
  const idUnchecked = [];
  while ((m = uncheckedRe.exec(text))) {
    idUnchecked.push(m[1]);
  }
  const idChecked = [];
  while ((m = checkedRe.exec(text))) {
    idChecked.push(m[1]);
  }

  if (idUnchecked.length + idChecked.length > 0) {
    total = idUnchecked.length + idChecked.length;
    checked = idChecked.length;
    uncheckedIds.push(...idUnchecked);
  } else {
    const u = text.match(uncheckedAny) || [];
    const c = text.match(checkedAny) || [];
    total = u.length + c.length;
    checked = c.length;
  }

  return {
    complete: total > 0 && uncheckedIds.length === 0 && checked === total,
    total,
    checked,
    uncheckedIds,
  };
}

/**
 * High-level: load shared + project, merge, select for selection result.
 * @param {{ projectManualPath?: string, sharedPath?: string, selection?: object }} opts
 */
export function buildManualChecklist(opts = {}) {
  const shared = loadSharedManual(opts.sharedPath);
  const project = loadManualFile(opts.projectManualPath);
  const merged = mergeManualLists(
    shared.items,
    project.items.map((it) => ({ ...it, source: 'project' }))
  );
  const selected = selectManualItems(merged, opts.selection || {});
  return {
    merged,
    selected,
    comment: renderManualChecklistComment(selected, {
      headSha: opts.selection?.headSha,
      scope: opts.selection?.scope,
      previewUrl: opts.selection?.previewUrl,
    }),
  };
}
