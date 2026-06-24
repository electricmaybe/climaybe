import pc from 'picocolors';
import { writeConfig } from '../lib/config.js';
import { scaffoldAiConfig, logAiConfigResult } from '../lib/cursor-bundle.js';
import { promptAiEditors } from '../lib/prompts.js';

/**
 * Install the Electric Maybe AI ruleset into .config/ai/ and bridge it to the chosen editors.
 * Can be run standalone or after init if the ruleset was skipped.
 */
export async function addCursorSkillCommand() {
  console.log(pc.bold('\n  climaybe — Add AI ruleset\n'));

  const editors = await promptAiEditors();
  writeConfig({ cursor_skills: true, ai_editors: editors });

  const result = scaffoldAiConfig(process.cwd(), { editors });
  logAiConfigResult(result, { pc });
  if (result.ok) {
    console.log(pc.dim('  See .config/ai/rules/00-rule-index.mdc for which rules apply when.\n'));
  } else {
    console.log(pc.dim('  Reinstall climaybe or report an issue.\n'));
  }
}
