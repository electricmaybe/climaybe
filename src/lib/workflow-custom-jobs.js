/**
 * Preserve repo-specific jobs in generated workflows.
 *
 * Some climaybe workflows (e.g. build-pipeline.yml) are commonly extended by
 * the target repo with extra jobs (unit tests, linters, ...). Regenerating the
 * workflow used to overwrite the file and silently delete those jobs.
 *
 * These helpers do a line-based parse of the top-level `jobs:` mapping (no YAML
 * dependency, keeps the user's text, comments and formatting byte-for-byte) so
 * that any job id not owned by the climaybe template can be carried over into
 * the freshly generated file.
 */

/** Workflow files whose repo-specific jobs survive `climaybe update`. */
export const PRESERVE_CUSTOM_JOBS_FILES = ['build-pipeline.yml'];

const TOP_LEVEL_KEY = /^[A-Za-z_"'][^:#]*:/;
const JOB_KEY = /^( +)([A-Za-z0-9_-]+|"[^"]+"|'[^']+'):\s*(#.*)?$/;

/**
 * Parse the top-level `jobs:` mapping of a workflow.
 * Returns { jobs: [{ id, text }], jobsEnd } or null when no `jobs:` block exists.
 * Each job's text includes the comment lines directly above its key.
 */
export function parseWorkflowJobs(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const jobsIdx = lines.findIndex((l) => /^jobs:\s*(#.*)?$/.test(l));
  if (jobsIdx === -1) return null;

  // Find end of jobs block: next top-level (unindented) key.
  let end = lines.length;
  for (let i = jobsIdx + 1; i < lines.length; i++) {
    if (TOP_LEVEL_KEY.test(lines[i])) {
      end = i;
      break;
    }
  }

  // Detect the job key indent from the first indented key.
  let indent = null;
  for (let i = jobsIdx + 1; i < end; i++) {
    const m = lines[i].match(JOB_KEY);
    if (m) {
      indent = m[1].length;
      break;
    }
  }
  if (indent === null) return { jobs: [], jobsEnd: end };

  const starts = [];
  for (let i = jobsIdx + 1; i < end; i++) {
    const m = lines[i].match(JOB_KEY);
    if (m && m[1].length === indent) starts.push({ i, id: m[2].replace(/^["']|["']$/g, '') });
  }

  // Each job owns the comment lines directly above its key.
  const froms = starts.map(({ i }, k) => {
    const floor = k === 0 ? jobsIdx + 1 : starts[k - 1].i + 1;
    let from = i;
    while (from - 1 >= floor) {
      const prev = lines[from - 1];
      const deep = prev.length - prev.trimStart().length >= indent;
      if (prev.trim().startsWith('#') && deep) from--;
      else break;
    }
    return from;
  });

  const jobs = starts.map(({ id }, k) => {
    const to = k + 1 < starts.length ? froms[k + 1] : end;
    const block = lines.slice(froms[k], to);
    while (block.length && block[block.length - 1].trim() === '') block.pop();
    return { id, text: block.join('\n') };
  });

  return { jobs, jobsEnd: end };
}

/**
 * Return the jobs in `existing` whose ids are not defined by `generated`.
 */
export function getCustomJobs(existing, generated) {
  const ex = parseWorkflowJobs(existing);
  const gen = parseWorkflowJobs(generated);
  if (!ex || !gen) return [];
  const owned = new Set(gen.jobs.map((j) => j.id));
  return ex.jobs.filter((j) => !owned.has(j.id));
}

/**
 * Append repo-specific jobs from `existing` to the end of the `jobs:` block in `generated`.
 * Returns { content, preserved: string[] }.
 */
export function mergeCustomJobs(existing, generated) {
  const custom = getCustomJobs(existing, generated);
  if (!custom.length) return { content: generated, preserved: [] };

  const lines = generated.replace(/\r\n/g, '\n').split('\n');
  const { jobsEnd } = parseWorkflowJobs(generated);
  let insertAt = jobsEnd;
  while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt--;

  const head = lines.slice(0, insertAt);
  const tail = lines.slice(insertAt);
  const added = [];
  for (const job of custom) added.push('', ...job.text.split('\n'));

  let content = [...head, ...added, ...tail].join('\n');
  if (!content.endsWith('\n')) content += '\n';
  return { content, preserved: custom.map((j) => j.id) };
}
