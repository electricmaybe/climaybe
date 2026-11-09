import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import pc from 'picocolors';
import {
  selectTests,
  loadSelectionRules,
  blockedTagsForFailures,
  skippedByImplication,
} from '../qa/lib/selection.js';
import { buildManualChecklist, parseManualChecklistProgress } from '../qa/lib/manual.js';
import { loadQaConfig, shouldRunForBaseBranch } from '../qa/lib/config-loader.js';
import { pickPreviewUrlFromComment, resolveQaStoreAlias } from '../qa/lib/preview-url.js';
import { renderAutoReportComment } from '../qa/lib/report.js';
import {
  CURSOR_API_KEY_SECRET,
  AUTOFIX_PR_MARKER,
  commentHasAutofixMarker,
  triggerCursorAutofix,
} from '../qa/lib/cursor-autofix.js';
import { getMode, readConfig } from '../lib/config.js';

/**
 * List changed theme files vs base ref.
 * @param {string} baseRef
 * @param {string} [cwd]
 */
export function listChangedFiles(baseRef, cwd = process.cwd()) {
  try {
    const out = execSync(`git diff --name-only ${baseRef}...HEAD`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    try {
      const out = execSync(`git diff --name-only ${baseRef}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return out
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}

/**
 * climaybe store-qa select — print JSON selection for CI.
 */
export async function storeQaSelectCommand(opts = {}) {
  const cwd = process.cwd();
  const base = opts.base || process.env.QA_BASE_REF || 'origin/main';
  const baseBranch = opts.baseBranch || process.env.QA_BASE_BRANCH || '';
  const headBranch = opts.headBranch || process.env.QA_HEAD_BRANCH || '';
  const files = opts.files
    ? String(opts.files)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    : listChangedFiles(base, cwd);

  const selection = selectTests(files, loadSelectionRules(), {
    baseBranch,
    headBranch,
    forceRelease: opts.release === true,
  });

  const { config: qaConfig } = loadQaConfig(cwd);
  selection.storeAlias = resolveQaStoreAlias(qaConfig, { baseBranch, headBranch });

  const outDir = opts.outDir || join(cwd, 'qa-results');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'selection.json');
  writeFileSync(outPath, JSON.stringify(selection, null, 2) + '\n', 'utf-8');

  if (opts.json !== false) {
    process.stdout.write(JSON.stringify(selection, null, 2) + '\n');
  } else {
    console.log(pc.green(`  Selection written → ${outPath}`));
    console.log(pc.dim(`  scope=${selection.scope} tags=${selection.tags.join(',')}`));
  }
  return selection;
}

/**
 * climaybe store-qa manual — merge + select manual checklist markdown.
 */
export async function storeQaManualCommand(opts = {}) {
  const cwd = process.cwd();
  const selectionPath = opts.selection || join(cwd, 'qa-results', 'selection.json');
  let selection = {};
  if (existsSync(selectionPath)) {
    selection = JSON.parse(readFileSync(selectionPath, 'utf-8'));
  }
  selection.headSha = opts.headSha || process.env.QA_HEAD_SHA || selection.headSha;
  selection.previewUrl = opts.previewUrl || process.env.QA_PREVIEW_URL || selection.previewUrl;

  const projectManualPath = join(cwd, 'qa', 'manual.yml');
  const previousBody =
    opts.previousBody || opts.previousbody || process.env.QA_PREVIOUS_MANUAL_BODY || '';
  const built = buildManualChecklist({
    projectManualPath: existsSync(projectManualPath) ? projectManualPath : undefined,
    selection,
    previousBody,
  });

  const outDir = join(cwd, 'qa-results');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'manual.md'), built.comment + '\n', 'utf-8');
  writeFileSync(
    join(outDir, 'manual.json'),
    JSON.stringify({ selected: built.selected, preservedCheckedIds: built.preservedCheckedIds }, null, 2) +
      '\n',
    'utf-8'
  );
  process.stdout.write(built.comment + '\n');
  return built;
}

/**
 * climaybe store-qa gate — exit 0 when store QA should run for this PR base.
 */
export async function storeQaGateCommand(opts = {}) {
  const cwd = process.cwd();
  const config = readConfig(cwd) || {};
  if (config.store_qa_workflows !== true) {
    console.log('skip: store_qa_workflows not enabled');
    process.exitCode = 2;
    return;
  }
  const { config: qaConfig } = loadQaConfig(cwd);
  const baseBranch = opts.baseBranch || process.env.QA_BASE_BRANCH || '';
  const mode = getMode(cwd);
  const ok = shouldRunForBaseBranch(baseBranch, {
    mode,
    qaConfig,
    climaybeConfig: config,
  });
  if (!ok) {
    console.log(`skip: base branch ${baseBranch} not in store QA bases`);
    process.exitCode = 2;
    return;
  }
  if (!existsSync(join(cwd, 'qa', 'config.yml')) && !existsSync(join(cwd, 'qa', 'config.json'))) {
    console.log('skip: qa/config.yml missing');
    process.exitCode = 2;
    return;
  }
  console.log('run');
  process.exitCode = 0;
}

/**
 * climaybe store-qa report — build auto comment from results.json
 */
export async function storeQaReportCommand(opts = {}) {
  const cwd = process.cwd();
  const resultsPath = opts.results || join(cwd, 'qa-results', 'results.json');
  const selectionPath = opts.selection || join(cwd, 'qa-results', 'selection.json');
  const selection = existsSync(selectionPath) ? JSON.parse(readFileSync(selectionPath, 'utf-8')) : {};
  const normalizedPath = join(cwd, 'qa-results', 'normalized-results.json');
  const funnelPath = join(cwd, 'qa-results', 'funnel-steps.json');
  const consolePath = join(cwd, 'qa-results', 'console-errors.json');

  let rows;
  if (existsSync(resultsPath)) {
    rows = normalizePlaywrightResults(JSON.parse(readFileSync(resultsPath, 'utf-8')));
  } else if (existsSync(normalizedPath)) {
    rows = JSON.parse(readFileSync(normalizedPath, 'utf-8'));
  } else {
    rows = [];
  }

  if (existsSync(funnelPath)) {
    try {
      const funnel = JSON.parse(readFileSync(funnelPath, 'utf-8'));
      const funnelRows = (funnel.steps || []).map((s) => ({
        id: s.id,
        title: s.title || s.id,
        status: s.status,
        viewport: 'funnel',
        error: s.error,
        tags: s.tags || [],
        consoleErrors: [],
      }));
      rows = applyGatekeeperToRows([...funnelRows, ...rows]);
    } catch {
      // ignore malformed funnel file
    }
  } else {
    rows = applyGatekeeperToRows(rows);
  }

  let consoleErrors = [];
  if (existsSync(consolePath)) {
    try {
      consoleErrors = JSON.parse(readFileSync(consolePath, 'utf-8'));
    } catch {
      consoleErrors = [];
    }
  }

  const comment = renderAutoReportComment({
    headSha: opts.headSha || process.env.QA_HEAD_SHA || '',
    previewUrl: opts.previewUrl || process.env.QA_PREVIEW_URL || '',
    scope: selection.scope,
    tags: selection.tags,
    results: rows,
    runUrl: opts.runUrl || process.env.QA_RUN_URL || '',
    autofix: opts.autofix || null,
    consoleErrors,
  });

  const outDir = join(cwd, 'qa-results');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'auto-comment.md'), comment + '\n', 'utf-8');
  writeFileSync(join(outDir, 'normalized-results.json'), JSON.stringify(rows, null, 2) + '\n', 'utf-8');
  process.stdout.write(comment + '\n');
  return { comment, rows, consoleErrors };
}

/**
 * climaybe store-qa autofix — optional Cursor cloud agent round (once per PR).
 */
export async function storeQaAutofixCommand(opts = {}) {
  const cwd = process.cwd();
  const resultsPath = opts.results || join(cwd, 'qa-results', 'normalized-results.json');
  const rows = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf-8')) : [];
  const headSha = opts.headSha || process.env.QA_HEAD_SHA || '';
  const priorComments = opts.priorComments || process.env.QA_PRIOR_COMMENTS || '';
  const testsFailed = rows.some((r) => r.status === 'failed') || opts.testsFailed === true;

  if (commentHasAutofixMarker(priorComments, headSha) || opts.alreadyRan) {
    const reason = testsFailed ? 'failed-still' : 'already-ran';
    const out = {
      ok: false,
      skipped: true,
      reason,
      marker: AUTOFIX_PR_MARKER,
    };
    mkdirSync(join(cwd, 'qa-results'), { recursive: true });
    writeFileSync(join(cwd, 'qa-results', 'autofix.json'), JSON.stringify(out, null, 2) + '\n');
    console.log(JSON.stringify(out));
    return out;
  }

  const result = await triggerCursorAutofix({
    apiKey: process.env[CURSOR_API_KEY_SECRET] || process.env.CURSOR_API_KEY,
    repositoryUrl: opts.repoUrl || process.env.QA_REPO_URL || '',
    prUrl: opts.prUrl || process.env.QA_PR_URL || '',
    headSha,
    branch: opts.branch || process.env.QA_HEAD_BRANCH || '',
    previewUrl: opts.previewUrl || process.env.QA_PREVIEW_URL || '',
    results: rows,
  });

  mkdirSync(join(cwd, 'qa-results'), { recursive: true });
  writeFileSync(join(cwd, 'qa-results', 'autofix.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  return result;
}

/**
 * climaybe store-qa parse-manual — check if all boxes ticked.
 */
export async function storeQaParseManualCommand(opts = {}) {
  const body = opts.body || process.env.QA_MANUAL_BODY || '';
  const progress = parseManualChecklistProgress(body);
  console.log(JSON.stringify(progress));
  process.exitCode = progress.complete ? 0 : 3;
  return progress;
}

/**
 * climaybe store-qa resolve-preview — pick preview URL pinned to head SHA (fail closed).
 */
export async function storeQaResolvePreviewCommand(opts = {}) {
  const commentsRaw = opts.comments || process.env.QA_PR_COMMENTS || '[]';
  let comments;
  try {
    comments = JSON.parse(commentsRaw);
  } catch {
    console.error('invalid comments JSON');
    process.exitCode = 2;
    return null;
  }
  const headSha = opts.headSha || process.env.QA_HEAD_SHA || '';
  const storeAlias = opts.storeAlias || process.env.QA_STORE_ALIAS || '';
  const mine = (comments || []).filter((c) => {
    const body = String(c.body || '');
    const bot = c.user?.type === 'Bot' || String(c.user?.login || '').endsWith('[bot]');
    return bot && body.includes('<!-- climaybe-preview-comment -->');
  });
  const body = (mine[mine.length - 1] || {}).body || '';
  const url = pickPreviewUrlFromComment(body, { headSha, storeAlias: storeAlias || null });
  if (!url) {
    console.error('FAIL: preview URL missing or not pinned to full head SHA');
    process.exitCode = 2;
    return null;
  }
  process.stdout.write(url + '\n');
  process.exitCode = 0;
  return url;
}

/**
 * Apply gatekeeper/implication rules onto normalized rows.
 * @param {import('../qa/lib/report.js').QaResultRow[]} rows
 */
export function applyGatekeeperToRows(rows) {
  const rules = loadSelectionRules();
  const failedTags = [];
  for (const row of rows) {
    if (row.status === 'failed') {
      for (const t of row.tags || []) failedTags.push(t);
      // Heuristic: map common titles to tags when tags missing
      if (!row.tags?.length) {
        if (/U01|smoke/i.test(row.id)) failedTags.push('@funnel-smoke');
        if (/U02|variant/i.test(row.id)) failedTags.push('@variant-change');
        if (/U06|qty increase/i.test(row.id)) failedTags.push('@funnel-qty-increase');
      }
    }
  }
  const blocked = new Set(blockedTagsForFailures(failedTags, rules));
  const proven = [];
  for (const row of rows) {
    if (row.status === 'passed') {
      for (const t of row.tags || []) proven.push(t);
    }
  }
  const impliedSkips = new Set(skippedByImplication(proven, rules));

  return rows.map((row) => {
    const tags = row.tags || [];
    if (row.status === 'failed' || row.status === 'blocked') return row;
    if (blocked.has('*') || tags.some((t) => blocked.has(t))) {
      return {
        ...row,
        status: 'blocked',
        error: row.error || `Blocked by prior failure (${failedTags.join(', ') || 'gatekeeper'})`,
      };
    }
    if (tags.some((t) => impliedSkips.has(t)) && row.status === 'passed') {
      // Keep passed if already executed; implication is for selection-time skips
      return row;
    }
    return row;
  });
}

/**
 * Normalize Playwright JSON reporter output into QaResultRow[].
 * @param {any} report
 */
export function normalizePlaywrightResults(report) {
  if (!report) return [];
  const rows = [];
  const suites = report.suites || [];
  const walk = (suite) => {
    for (const s of suite.suites || []) walk(s);
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const project = t.projectName || t.projectId || '';
        const result = (t.results || [])[(t.results || []).length - 1] || {};
        let status = 'passed';
        if (t.status === 'skipped' || result.status === 'skipped') status = 'skipped';
        else if (t.status === 'expected' || result.status === 'passed') status = 'passed';
        else if (result.status === 'timedOut' || result.status === 'failed' || t.status === 'unexpected') {
          status = 'failed';
        }
        const ann = (t.results || []).flatMap((r) => r.annotations || []);
        if (ann.some((a) => a.type === 'blocked')) status = 'blocked';

        rows.push({
          id: spec.title || t.title || 'test',
          title: spec.title || t.title || 'test',
          status,
          viewport: project,
          error: (result.errors || []).map((e) => e.message || e).join('\n') || undefined,
          consoleErrors: [],
          tags: [],
        });
      }
    }
  };
  for (const s of suites) walk(s);

  if (!rows.length && Array.isArray(report)) return report;
  return applyGatekeeperToRows(rows);
}
