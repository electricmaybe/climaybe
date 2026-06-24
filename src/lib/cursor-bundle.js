import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  lstatSync,
  rmSync,
  copyFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Bundled Electric Maybe AI rules, skills, and subagents (shipped under src/cursor/). */
const BUNDLE_ROOT = join(__dirname, '..', 'cursor');

const SKIP_NAMES = new Set(['.DS_Store']);

/** Single source of truth for AI/editor config inside the target repo. */
export const AI_CONFIG_DIR = '.config/ai';

/** Canonical entry doc that the flat editor files (AGENTS.md, CLAUDE.md, …) point at. */
export const AI_RULES_ENTRY = `${AI_CONFIG_DIR}/rules.md`;

/**
 * Editor "bridges" — each maps an editor's expected path to the shared source of truth.
 * `kind: 'dir'` links a folder (the editor reads rules/skills/agents from it);
 * `kind: 'file'` links a single instructions file to the combined rules entry doc.
 */
export const EDITOR_BRIDGES = {
  cursor: { label: 'Cursor', bridges: [{ link: '.cursor', target: AI_CONFIG_DIR, kind: 'dir' }] },
  windsurf: { label: 'Windsurf', bridges: [{ link: '.windsurf', target: AI_CONFIG_DIR, kind: 'dir' }] },
  cline: { label: 'Cline / Roo Code', bridges: [{ link: '.clinerules', target: AI_CONFIG_DIR, kind: 'dir' }] },
  claude: { label: 'Claude Code', bridges: [{ link: 'CLAUDE.md', target: AI_RULES_ENTRY, kind: 'file' }] },
  copilot: {
    label: 'GitHub Copilot / VS Code',
    bridges: [{ link: '.github/copilot-instructions.md', target: AI_RULES_ENTRY, kind: 'file' }],
  },
  agents: { label: 'Other editors (AGENTS.md)', bridges: [{ link: 'AGENTS.md', target: AI_RULES_ENTRY, kind: 'file' }] },
};

const RULES_ENTRY_CONTENT = `# Electric Maybe — AI ruleset

This file is the shared entry point for AI/editor assistants working in this repo.
The real content lives in \`${AI_CONFIG_DIR}/\`; every editor reads it through a bridge
file or symlink, so there is a single source of truth and nothing to duplicate.

- **Rules:** \`${AI_CONFIG_DIR}/rules/\` — start with \`00-rule-index.mdc\`
- **Skills:** \`${AI_CONFIG_DIR}/skills/\`
- **Agents / subagents:** \`${AI_CONFIG_DIR}/agents/\`

Edit files under \`${AI_CONFIG_DIR}/\` only. Bridges (\`.cursor\`, \`.windsurf\`,
\`.clinerules\`, \`AGENTS.md\`, \`CLAUDE.md\`, \`.github/copilot-instructions.md\`) point back
here, so a change is picked up by every editor at once.
`;

const isWindows = process.platform === 'win32';

/**
 * Recursively copy directory tree; skips junk files (e.g. .DS_Store).
 * @param {string} src
 * @param {string} dest
 */
function copyTree(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    if (SKIP_NAMES.has(name)) continue;
    const from = join(src, name);
    const to = join(dest, name);
    if (statSync(from).isDirectory()) {
      copyTree(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}

function removeIfExists(path) {
  try {
    lstatSync(path);
    rmSync(path, { recursive: true, force: true });
  } catch {
    // nothing to remove
  }
}

/**
 * Create one editor bridge to the shared source of truth.
 * Prefers a symlink (so there is zero duplication); falls back to copying when the
 * platform refuses symlinks (e.g. Windows without privilege).
 * @returns {{ link: string, mode: 'symlink' | 'copy' }}
 */
function createBridge(cwd, { link, target, kind }) {
  const linkPath = join(cwd, link);
  const absTarget = join(cwd, target);
  mkdirSync(dirname(linkPath), { recursive: true });
  removeIfExists(linkPath);

  try {
    if (kind === 'dir') {
      // Junctions on Windows need an absolute target and no privilege; POSIX uses a
      // relative symlink so the repo stays portable when moved or cloned.
      const symType = isWindows ? 'junction' : 'dir';
      const symTarget = isWindows ? absTarget : relative(dirname(linkPath), absTarget);
      symlinkSync(symTarget, linkPath, symType);
    } else {
      const symTarget = relative(dirname(linkPath), absTarget);
      symlinkSync(symTarget, linkPath, 'file');
    }
    return { link, mode: 'symlink' };
  } catch {
    // Fallback: copy so the file/folder still exists even without symlink support.
    if (kind === 'dir') {
      copyTree(absTarget, linkPath);
    } else {
      copyFileSync(absTarget, linkPath);
    }
    return { link, mode: 'copy' };
  }
}

/**
 * Install the Electric Maybe AI bundle into `.config/ai/` (single source of truth) and
 * create bridge files/symlinks for the chosen editors.
 *
 * @param {string} [cwd] - Working directory (default process.cwd())
 * @param {{ editors?: string[] }} [opts] - Editor keys from EDITOR_BRIDGES (default: ['cursor'])
 * @returns {{ ok: boolean, editors: string[], bridges: Array<{link: string, mode: string}> }}
 */
export function scaffoldAiConfig(cwd = process.cwd(), { editors = ['cursor'] } = {}) {
  const rulesSrc = join(BUNDLE_ROOT, 'rules');
  const skillsSrc = join(BUNDLE_ROOT, 'skills');
  const agentsSrc = join(BUNDLE_ROOT, 'agents');
  if (!existsSync(rulesSrc) || !existsSync(skillsSrc) || !existsSync(agentsSrc)) {
    return { ok: false, editors: [], bridges: [] };
  }

  const aiRoot = join(cwd, AI_CONFIG_DIR);
  copyTree(rulesSrc, join(aiRoot, 'rules'));
  copyTree(skillsSrc, join(aiRoot, 'skills'));
  copyTree(agentsSrc, join(aiRoot, 'agents'));
  writeFileSync(join(cwd, AI_RULES_ENTRY), RULES_ENTRY_CONTENT, 'utf-8');

  const selected = editors.filter((key) => EDITOR_BRIDGES[key]);
  const bridges = [];
  for (const key of selected) {
    for (const bridge of EDITOR_BRIDGES[key].bridges) {
      bridges.push(createBridge(cwd, bridge));
    }
  }
  return { ok: true, editors: selected, bridges };
}

/**
 * Pretty-print the outcome of scaffoldAiConfig() with picocolors. Lazily imported so
 * this module stays usable in non-CLI contexts (tests) without color deps.
 * @param {ReturnType<typeof scaffoldAiConfig>} result
 * @param {{ pc: import('picocolors').Picocolors }} deps
 */
export function logAiConfigResult(result, { pc }) {
  if (!result.ok) {
    console.log(pc.yellow('  AI ruleset not found in this climaybe install (skipped).'));
    return;
  }
  console.log(pc.green(`  Electric Maybe AI ruleset → ${AI_CONFIG_DIR}/ (rules, skills, agents)`));
  if (result.bridges.length > 0) {
    const links = result.bridges.map((b) => (b.mode === 'copy' ? `${b.link} (copy)` : b.link));
    console.log(pc.dim(`  Editor bridges: ${links.join(', ')}`));
    if (result.bridges.some((b) => b.mode === 'copy')) {
      console.log(pc.dim('  (Some bridges were copied because this platform blocked symlinks.)'));
    }
  }
  console.log(pc.dim(`  Edit rules in ${AI_CONFIG_DIR}/ — every bridged editor reads the same files.`));
}

/**
 * Back-compat wrapper for callers that only want the Cursor bridge.
 * @param {string} [cwd]
 * @returns {boolean} false if bundle source is missing (broken install)
 */
export function scaffoldCursorBundle(cwd = process.cwd()) {
  return scaffoldAiConfig(cwd, { editors: ['cursor'] }).ok;
}
