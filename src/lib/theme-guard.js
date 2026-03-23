import pc from 'picocolors';
import { getProjectType } from './config.js';

/**
 * @param {string} [cwd]
 * @returns {boolean} false if the repo is an app project (caller should return early).
 */
export function requireThemeProject(cwd = process.cwd()) {
  if (getProjectType(cwd) !== 'app') return true;
  console.log(pc.red('  This command is for theme repos only. This project has project_type: app.'));
  console.log(pc.dim('  Use climaybe app init for app setup; theme stores and workflows do not apply here.\n'));
  return false;
}
