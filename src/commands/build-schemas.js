import pc from 'picocolors';
import { requireThemeProject } from '../lib/theme-guard.js';
import { buildSchemas, listSchemaFiles, listSectionsWithSchemaRefs } from '../lib/schema-builder.js';

export async function buildSchemasCommand(opts = {}) {
  console.log(pc.bold('\n  climaybe — Build schemas\n'));
  if (!requireThemeProject()) return;

  try {
    const dryRun = opts.dryRun === true;
    const list = opts.list === true;

    if (list) {
      const schemas = listSchemaFiles(process.cwd());
      const refs = listSectionsWithSchemaRefs(process.cwd());

      if (schemas.length === 0 && refs.length === 0) {
        console.log(pc.yellow('  No _schemas/ files or schema markers found.'));
        return;
      }

      if (schemas.length > 0) {
        console.log(pc.cyan('  Schema source files (_schemas/):'));
        for (const s of schemas) {
          console.log(pc.dim(`    - ${s}`));
        }
      }

      if (refs.length > 0) {
        console.log(pc.cyan('\n  Files with schema markers:'));
        for (const { section, schemas: names } of refs) {
          console.log(`    ${pc.white(section)} → ${names.map((r) => pc.green(r)).join(', ')}`);
        }
      }
      return;
    }

    if (dryRun) {
      console.log(pc.dim('  Dry run — no files will be written.\n'));
    }

    const { processed, skipped, errors } = buildSchemas({ cwd: process.cwd(), dryRun });

    if (processed.length === 0 && errors.length === 0 && skipped.length === 0) {
      console.log(pc.yellow('  No sections/ or blocks/ directory found. Nothing to build.'));
      return;
    }

    if (processed.length === 0 && errors.length === 0) {
      console.log(pc.yellow('  No schema markers found in sections/ or blocks/.'));
      console.log(pc.dim("  Add a marker to a liquid file:  {% # schema 'name' %}"));
      return;
    }

    if (processed.length > 0) {
      const verb = dryRun ? 'Would generate' : 'Generated';
      console.log(pc.green(`  ${verb} schemas for ${processed.length} file(s):`));
      for (const { section, schemaName } of processed) {
        console.log(pc.dim(`    - ${section} ← _schemas/${schemaName}`));
      }
    }

    if (errors.length > 0) {
      console.log(pc.red(`\n  ${errors.length} error(s):`));
      for (const { section, schema, error } of errors) {
        console.log(pc.red(`    ${section} (schema: ${schema}): ${error}`));
      }
      process.exitCode = 1;
    }
  } catch (err) {
    console.log(pc.red(`  Build error: ${err.message}`));
    process.exitCode = 1;
  }
}
