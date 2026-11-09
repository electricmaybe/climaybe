/**
 * Format the qa-auto PR comment and auto-fix failure package.
 */

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   status: 'passed' | 'failed' | 'blocked' | 'skipped',
 *   viewport?: string,
 *   error?: string,
 *   screenshot?: string,
 *   trace?: string,
 *   consoleErrors?: string[],
 *   tags?: string[],
 * }} QaResultRow
 */

/**
 * @param {{
 *   headSha: string,
 *   previewUrl?: string,
 *   scope?: string,
 *   tags?: string[],
 *   results: QaResultRow[],
 *   runUrl?: string,
 *   consoleErrors?: string[],
 *   autofix?: 'triggered' | 'skipped-missing-secret' | 'skipped-already-ran' | 'skipped-no-failures' | 'failed-still' | null,
 * }} data
 */
export function renderAutoReportComment(data) {
  const marker = '<!-- climaybe-qa-auto -->';
  const results = data.results || [];
  const passed = results.filter((r) => r.status === 'passed');
  const failed = results.filter((r) => r.status === 'failed');
  const blocked = results.filter((r) => r.status === 'blocked');
  const skipped = results.filter((r) => r.status === 'skipped');
  const consoleErrors = uniqueStrings([
    ...(data.consoleErrors || []),
    ...results.flatMap((r) => r.consoleErrors || []),
  ]);

  const lines = [
    marker,
    `<!-- climaybe-qa-auto-sha:${data.headSha || ''} -->`,
    '## Store QA — automated results',
    '',
    `| | Count |`,
    `| --- | ---: |`,
    `| Passed | ${passed.length} |`,
    `| Failed | ${failed.length} |`,
    `| Blocked | ${blocked.length} |`,
    `| Skipped | ${skipped.length} |`,
    '',
    data.scope ? `Scope: **${data.scope}**` : null,
    data.previewUrl ? `Preview: ${data.previewUrl}` : null,
    data.headSha ? `Head: \`${data.headSha}\`` : null,
    data.tags?.length ? `Tags: \`${data.tags.join(' ')}\`` : null,
    data.runUrl ? `Run: ${data.runUrl}` : null,
    '',
  ].filter((l) => l != null);

  if (failed.length) {
    lines.push('### Failed');
    for (const row of failed) {
      lines.push(`- **${row.id}** (${row.viewport || 'n/a'}): ${row.error || row.title}`);
      if (row.screenshot) lines.push(`  - Screenshot: ${row.screenshot}`);
      if (row.trace) lines.push(`  - Trace: ${row.trace}`);
      if (row.consoleErrors?.length) {
        lines.push(`  - Console: ${row.consoleErrors.slice(0, 5).join(' | ')}`);
      }
    }
    lines.push('');
  }

  if (blocked.length) {
    lines.push('### Blocked (prerequisite failed)');
    for (const row of blocked) {
      lines.push(`- **${row.id}** (${row.viewport || 'n/a'}): ${row.title}${row.error ? ` — ${row.error}` : ''}`);
    }
    lines.push('');
  }

  if (consoleErrors.length) {
    lines.push('### Console / network errors');
    for (const err of consoleErrors.slice(0, 20)) {
      lines.push(`- \`${err.replace(/`/g, "'")}\``);
    }
    if (consoleErrors.length > 20) {
      lines.push(`- _…and ${consoleErrors.length - 20} more_`);
    }
    lines.push('');
  }

  if (data.autofix === 'triggered') {
    lines.push('> Auto-fix: launched one Cursor cloud agent for this PR (escalate-once).');
  } else if (data.autofix === 'skipped-missing-secret') {
    lines.push('> Auto-fix: skipped (`CURSOR_API_KEY` not set).');
  } else if (data.autofix === 'skipped-already-ran') {
    lines.push('> Auto-fix: already attempted once on this PR — owner action needed.');
  } else if (data.autofix === 'failed-still') {
    lines.push(
      '> Auto-fix already ran once on this PR and tests still fail. **Owner action required.** Never auto-merges. No further agents will be launched.'
    );
  } else if (data.autofix === 'skipped-no-failures') {
    lines.push('> Auto-fix: not needed.');
  }

  lines.push('');
  lines.push('_Updated in place by climaybe store QA._');
  return lines.join('\n');
}

/**
 * Bundle all failures for the Cursor cloud agent prompt.
 * @param {{
 *   headSha: string,
 *   previewUrl?: string,
 *   prUrl?: string,
 *   branch?: string,
 *   results: QaResultRow[],
 *   artifactUrls?: string[],
 * }} data
 */
export function buildAutofixPackage(data) {
  const failures = (data.results || []).filter((r) => r.status === 'failed');
  return {
    headSha: data.headSha,
    previewUrl: data.previewUrl || null,
    prUrl: data.prUrl || null,
    branch: data.branch || null,
    artifactUrls: data.artifactUrls || [],
    failures: failures.map((f) => ({
      step: f.id,
      title: f.title,
      expectedVsActual: f.error || 'See Playwright report',
      viewport: f.viewport || null,
      screenshot: f.screenshot || null,
      trace: f.trace || null,
      consoleErrors: f.consoleErrors || [],
      previewUrl: data.previewUrl || null,
      headSha: data.headSha,
    })),
  };
}

/**
 * @param {ReturnType<typeof buildAutofixPackage>} pkg
 */
export function renderAutofixPrompt(pkg) {
  const lines = [
    'You are fixing failing store QA Playwright tests on an existing PR branch.',
    'Do NOT open a new PR. Do NOT merge. Push fixes to the same head branch.',
    'Fix ALL bundled failures in one pass. Prefer theme-safe, minimal diffs.',
    'This is the only auto-fix round for this PR — make it count.',
    '',
    `PR: ${pkg.prUrl || '(unknown)'}`,
    `Branch: ${pkg.branch || '(unknown)'}`,
    `Head SHA (before your fix): ${pkg.headSha}`,
    `Preview URL: ${pkg.previewUrl || '(unknown)'}`,
    '',
    '## Failures',
    '```json',
    JSON.stringify(pkg.failures, null, 2),
    '```',
    '',
    'After fixing, ensure the purchase funnel still works (PDP → variant → ATC → qty → checkout handoff).',
    'Leave a short summary of what you changed.',
  ];
  return lines.join('\n');
}

/**
 * @param {string[]} list
 */
function uniqueStrings(list) {
  return [...new Set((list || []).filter(Boolean).map(String))];
}
