import pc from 'picocolors';
import { requireThemeProject } from '../lib/theme-guard.js';
import { buildSchemas, listSchemaFiles, listSectionsWithSchemaRefs } from '../lib/schema-builder.js';

export async function buildSchemasCommand(opts = {}) {
  console.log(pc.bold('\n  climaybe — Build section schemas\n'));
  if (!requireThemeProject()) return;

  try {
    const dryRun = opts.dryRun === true;
    const list = opts.list === true;

    if (list) {
      const schemas = listSchemaFiles(process.cwd());
      const sections = listSectionsWithSchemaRefs(process.cwd());

      if (schemas.length === 0 && sections.length === 0) {
        console.log(pc.yellow('  No _schemas/ files or _sections/ schema references found.'));
        return;
      }

      if (schemas.length > 0) {
        console.log(pc.cyan('  Schema source files (_schemas/):'));
        for (const s of schemas) {
          console.log(pc.dim(`    - ${s}`));
        }
      }

      if (sections.length > 0) {
        console.log(pc.cyan('\n  Source sections with schema references (_sections/):'));
        for (const { section, schemas: refs } of sections) {
          console.log(`    ${pc.white(section)} → ${refs.map((r) => pc.green(r)).join(', ')}`);
        }
      }
      return;
    }

    if (dryRun) {
      console.log(pc.dim('  Dry run — no files will be written.\n'));
    }

    const { processed, copied, errors } = buildSchemas({ cwd: process.cwd(), dryRun });

    if (processed.length === 0 && errors.length === 0 && copied.length === 0) {
      console.log(pc.yellow('  No _sections/ directory found. Nothing to build.'));
      console.log(pc.dim('  Create _sections/*.liquid source files and _schemas/*.js schema definitions.'));
      console.log(pc.dim('  Reference schemas in _sections/ with {% schema \'name\' %}{% endschema %}'));
      console.log(pc.dim('  The builder outputs to sections/ (what Shopify reads).'));
      return;
    }

    if (processed.length > 0) {
      const verb = dryRun ? 'Would build' : 'Built';
      console.log(pc.green(`  ${verb} ${processed.length} section(s) with injected schemas:`));
      for (const { section } of processed) {
        console.log(pc.dim(`    _sections/${section} → sections/${section}`));
      }
    }

    if (copied.length > 0) {
      const verb = dryRun ? 'Would copy' : 'Copied';
      console.log(pc.dim(`\n  ${verb} ${copied.length} section(s) without schema references.`));
    }

    if (errors.length > 0) {
      console.log(pc.red(`\n  ${errors.length} error(s):`));
      for (const { section, schema, error } of errors) {
        console.log(pc.red(`    _sections/${section} (schema: ${schema}): ${error}`));
      }
      process.exitCode = 1;
    }
  } catch (err) {
    console.log(pc.red(`  Build error: ${err.message}`));
    process.exitCode = 1;
  }
}
