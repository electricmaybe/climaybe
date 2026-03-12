import pc from 'picocolors';
import { writeConfig } from '../lib/config.js';
import { scaffoldCursorCommitSkill } from '../lib/commit-tooling.js';

/**
 * Add only the Cursor commit skill to this project (.cursor/skills/commit/SKILL.md).
 * Can be run standalone or after init without having chosen Cursor skills at init.
 */
export async function addCursorSkillCommand() {
  console.log(pc.bold('\n  climaybe — Add Cursor commit skill\n'));

  writeConfig({ cursor_skills: true });

  scaffoldCursorCommitSkill();
  console.log(pc.green('  Cursor commit skill added to .cursor/skills/commit/SKILL.md'));
  console.log(pc.dim('  Use "commit" or "group and commit" in Cursor to get conventional-commit assistance.\n'));
}
