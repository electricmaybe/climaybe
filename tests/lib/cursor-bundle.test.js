import { mkdtempSync, rmSync, existsSync, readFileSync, lstatSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { scaffoldAiConfig, scaffoldCursorBundle } from '../../src/lib/cursor-bundle.js';

const RULES_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'cursor', 'rules');

const FIGMA_COLLECTION_CATALOG = [
  '01.01 Theme/Primitives',
  '01.02 Theme/Brand',
  '02.01 Base/Sizes',
  '02.02 Base/Colors',
  '02.03 Base/Alphacolors',
  '03.01 Components/Sizes',
  '03.02 Components/Colors',
];

function assertDiscoveryContract(text, label) {
  assert.ok(!/EISCO|Eisco/i.test(text), `${label} must not name EISCO`);
  assert.ok(!/Voldt/i.test(text), `${label} must not name Voldt`);
  assert.ok(!text.includes('7-collection'), `${label} must not treat 7-collection as SSOT`);
  assert.ok(!text.includes('Alphacolors'), `${label} must not bake Alphacolors`);
  assert.ok(!text.includes('brand-educational'), `${label} must not prescribe brand-educational`);
  assert.ok(!text.includes('brand-industrial'), `${label} must not prescribe brand-industrial`);
  assert.doesNotMatch(
    text,
    /primary\s*\|\s*secondary\s*\|\s*muted\s*\|\s*accent\s*\|\s*contrast\s*\|\s*elevated/,
    `${label} must not lock a six-tone list`
  );
  for (const collection of FIGMA_COLLECTION_CATALOG) {
    assert.ok(!text.includes(collection), `${label} must not bake ${collection}`);
  }
}

describe('cursor-bundle (AI config)', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-ai-config-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  it('installs rules, skills, agents, and rules.md into .config/ai (source of truth)', () => {
    const dir = setup();
    try {
      const result = scaffoldAiConfig(dir, { editors: ['cursor'] });
      assert.strictEqual(result.ok, true);

      const indexPath = join(dir, '.config', 'ai', 'rules', '00-rule-index.mdc');
      const skillPath = join(dir, '.config', 'ai', 'skills', 'commit', 'SKILL.md');
      const agentPath = join(dir, '.config', 'ai', 'agents', 'theme-translator.md');
      assert.ok(existsSync(indexPath));
      assert.ok(existsSync(skillPath));
      assert.ok(existsSync(agentPath));
      assert.ok(existsSync(join(dir, '.config', 'ai', 'rules.md')));
      assert.ok(readFileSync(indexPath, 'utf-8').includes('Rule Index'));
      const skill = readFileSync(skillPath, 'utf-8');
      assert.ok(skill.includes('name: commit'));
      assert.ok(skill.includes('conventional'));
      assert.ok(readFileSync(agentPath, 'utf-8').includes('name: theme-translator'));
      assert.ok(existsSync(join(dir, '.config', 'ai', 'rules', 'examples', 'section-example.liquid')));
    } finally {
      teardown();
    }
  });

  it('creates editor bridges that resolve back to the shared source of truth', () => {
    const dir = setup();
    try {
      const result = scaffoldAiConfig(dir, { editors: ['cursor', 'claude', 'copilot'] });
      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(
        result.bridges.map((b) => b.link).sort(),
        ['.cursor', '.github/copilot-instructions.md', 'CLAUDE.md'].sort()
      );

      // Dir bridge: .cursor -> .config/ai (rules reachable through it).
      assert.ok(existsSync(join(dir, '.cursor', 'rules', '00-rule-index.mdc')));
      // File bridges resolve to the combined rules entry doc.
      assert.ok(readFileSync(join(dir, 'CLAUDE.md'), 'utf-8').includes('AI ruleset'));
      assert.ok(
        readFileSync(join(dir, '.github', 'copilot-instructions.md'), 'utf-8').includes('AI ruleset')
      );

      // On this platform bridges should be symlinks (zero duplication).
      if (process.platform !== 'win32') {
        assert.ok(lstatSync(join(dir, '.cursor')).isSymbolicLink());
        assert.ok(lstatSync(join(dir, 'CLAUDE.md')).isSymbolicLink());
      }
    } finally {
      teardown();
    }
  });

  it('only creates bridges for the selected editors', () => {
    const dir = setup();
    try {
      scaffoldAiConfig(dir, { editors: ['windsurf'] });
      assert.ok(existsSync(join(dir, '.windsurf', 'rules', '00-rule-index.mdc')));
      assert.ok(!existsSync(join(dir, '.cursor')));
      assert.ok(!existsSync(join(dir, 'CLAUDE.md')));
    } finally {
      teardown();
    }
  });

  it('ships every bundled .mdc rule, including always-on theme-color-modes', () => {
    const dir = setup();
    try {
      assert.strictEqual(scaffoldAiConfig(dir, { editors: ['cursor'] }).ok, true);

      const shippedDir = join(dir, '.config', 'ai', 'rules');
      const srcRules = readdirSync(RULES_SRC).filter((name) => name.endsWith('.mdc'));
      assert.ok(srcRules.includes('theme-color-modes.mdc'));
      for (const name of srcRules) {
        assert.ok(existsSync(join(shippedDir, name)), `missing shipped rule ${name}`);
      }

      const modeRule = readFileSync(join(shippedDir, 'theme-color-modes.mdc'), 'utf-8');
      const index = readFileSync(join(shippedDir, '00-rule-index.mdc'), 'utf-8');
      const figma = readFileSync(join(shippedDir, 'figma-design-system.mdc'), 'utf-8');
      const tailwind = readFileSync(join(shippedDir, 'tailwindcss-rules.mdc'), 'utf-8');
      const sectionSkill = readFileSync(
        join(dir, '.config', 'ai', 'skills', 'section-from-spec', 'SKILL.md'),
        'utf-8'
      );

      assertDiscoveryContract(modeRule, 'theme-color-modes.mdc');
      assertDiscoveryContract(figma, 'figma-design-system.mdc');
      assertDiscoveryContract(tailwind, 'tailwindcss-rules.mdc');
      assertDiscoveryContract(index, '00-rule-index.mdc');
      assertDiscoveryContract(sectionSkill, 'section-from-spec SKILL.md');

      assert.match(modeRule, /alwaysApply:\s*true/);
      assert.ok(modeRule.includes('illustrative'));
      assert.match(modeRule, /[Dd]iscover first/);
      assert.ok(modeRule.includes('_styles/'));
      assert.ok(modeRule.includes('color-schema'));
      assert.match(modeRule, /text-\[#d1d1d1\]/);
      assert.ok(modeRule.includes('text-{{ color }}') || modeRule.includes('Liquid-built'));
      assert.match(modeRule, /[Aa]xes are optional/);
      assert.match(modeRule, /only if/);
      assert.ok(modeRule.includes('<html'));
      assert.ok(modeRule.includes('intersection'));
      assert.ok(
        modeRule.includes('accent-1') && modeRule.includes('accent-2') && modeRule.includes('accent-3')
      );
      assert.doesNotMatch(modeRule, /[Oo]lder[\s\S]{0,80}accent-1/);
      assert.ok(modeRule.includes('max-w-'));
      assert.ok(modeRule.includes('stock Tailwind'));
      assert.ok(modeRule.includes('a--button'));
      assert.ok(modeRule.includes('does **not** scaffold') || modeRule.includes('does not scaffold'));

      assert.ok(index.includes('theme-color-modes.mdc'));
      assert.ok(index.includes('tailwindcss-rules.mdc'));
      assert.ok(index.includes('figma-design-system.mdc'));
      assert.match(index, /must read.*theme-color-modes\.mdc[\s\S]*tailwindcss-rules\.mdc/);
      assert.match(index, /must read.*theme-color-modes\.mdc[\s\S]*figma-design-system.mdc/);
      assert.ok(index.includes('<html>') || index.includes('`<html>`'));
      assert.ok(index.includes('discover') || index.includes('Discover'));

      assert.ok(!figma.includes('Voldt Theme'));
      assert.ok(!figma.includes('--color-dune-'));
      assert.ok(figma.includes('theme-color-modes.mdc'));
      assert.ok(figma.includes('a--button'));
      assert.ok(figma.includes('max-w-'));
      assert.ok(figma.includes('stock Tailwind') || figma.includes('stock Tailwind values'));
      assert.ok(figma.includes('accent-1'));
      assert.doesNotMatch(figma, /[Oo]lder[\s\S]{0,80}accent-1/);
      assert.ok(figma.includes('does not scaffold') || figma.includes('Do **not** scaffold'));

      assert.ok(tailwind.includes('theme-color-modes.mdc'));
      assert.ok(!tailwind.includes('--color-dune-'));
      assert.ok(!tailwind.includes('--color-abbey-'));
      assert.ok(tailwind.includes('accent-1'));
      assert.doesNotMatch(tailwind, /[Oo]lder[\s\S]{0,80}accent-1/);
      assert.ok(tailwind.includes('max-w-'));
      assert.ok(tailwind.includes('<html'));
      assert.ok(tailwind.includes('a--button'));
      assert.ok(tailwind.includes('optional') || tailwind.includes('only if'));
    } finally {
      teardown();
    }
  });

  it('back-compat wrapper installs the Cursor bridge and returns true', () => {
    const dir = setup();
    try {
      assert.strictEqual(scaffoldCursorBundle(dir), true);
      assert.ok(existsSync(join(dir, '.cursor', 'rules', '00-rule-index.mdc')));
      assert.ok(existsSync(join(dir, '.config', 'ai', 'rules', '00-rule-index.mdc')));
    } finally {
      teardown();
    }
  });
});
