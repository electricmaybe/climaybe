import pc from 'picocolors';
import { writeConfig } from '../lib/config.js';
import { scaffoldCursorBundle } from '../lib/cursor-bundle.js';

/**
 * Install Electric Maybe Cursor rules and skills (.cursor/rules, .cursor/skills).
 * Can be run standalone or after init if Cursor bundle was skipped.
 */
export async function addCursorSkillCommand() {
  console.log(pc.bold('\n  climaybe — Add Cursor rules + skills\n'));

  writeConfig({ cursor_skills: true });

  const ok = scaffoldCursorBundle();
  if (ok) {
    console.log(pc.green('  Installed .cursor/rules and .cursor/skills from climaybe bundle.'));
    console.log(pc.dim('  See .cursor/rules/00-rule-index.mdc for which rules apply when.\n'));
  } else {
    console.log(pc.red('  Cursor bundle not found in this climaybe install.'));
    console.log(pc.dim('  Reinstall climaybe or report an issue.\n'));
  }
}
