import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  readPkg,
  readConfig,
  writeConfig,
  readClimaybeConfig,
  migrateLegacyPackageConfigToClimaybe,
  getStoreAliases,
  getMode,
  isPreviewWorkflowsEnabled,
  isBuildWorkflowsEnabled,
  isProfileWorkflowsEnabled,
  isCommitlintEnabled,
  isCursorSkillsEnabled,
  addStoreToConfig,
  getProjectType,
  isThemeProjectForAppInit,
} from '../../src/lib/config.js';

describe('config', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-config-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  describe('readPkg', () => {
    it('returns null when package.json does not exist', () => {
      const dir = setup();
      try {
        assert.strictEqual(readPkg(dir), null);
      } finally {
        teardown();
      }
    });

    it('returns parsed package.json when it exists', () => {
      const dir = setup();
      try {
        const pkg = { name: 'my-theme', version: '1.0.0' };
        writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg), 'utf-8');
        assert.deepStrictEqual(readPkg(dir), pkg);
      } finally {
        teardown();
      }
    });
  });

  describe('readConfig', () => {
    it('returns null when no package.json and no climaybe config file', () => {
      const dir = setup();
      try {
        assert.strictEqual(readConfig(dir), null);
      } finally {
        teardown();
      }
    });

    it('returns null when package.json has no config key', () => {
      const dir = setup();
      try {
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x' }), 'utf-8');
        assert.strictEqual(readConfig(dir), null);
      } finally {
        teardown();
      }
    });

    it('returns climaybe.config.json when present', () => {
      const dir = setup();
      try {
        const config = { port: 9295, stores: { foo: 'foo.myshopify.com' } };
        writeFileSync(join(dir, 'climaybe.config.json'), JSON.stringify(config), 'utf-8');
        assert.deepStrictEqual(readConfig(dir), config);
      } finally {
        teardown();
      }
    });

    it('returns config object when present', () => {
      const dir = setup();
      try {
        const config = { port: 9295, stores: { foo: 'foo.myshopify.com' } };
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', config }), 'utf-8');
        assert.deepStrictEqual(readConfig(dir), config);
      } finally {
        teardown();
      }
    });
  });

  describe('writeConfig', () => {
    it('creates climaybe.config.json when missing', () => {
      const dir = setup();
      try {
        writeConfig({ port: 9295, stores: {} }, dir);
        const cfg = readClimaybeConfig(dir);
        assert.ok(cfg);
        assert.strictEqual(cfg.port, 9295);
        assert.deepStrictEqual(cfg.stores, {});
      } finally {
        teardown();
      }
    });

    it('merges config into existing climaybe.config.json', () => {
      const dir = setup();
      try {
        writeFileSync(join(dir, 'climaybe.config.json'), JSON.stringify({ port: 9295 }, null, 2), 'utf-8');
        writeConfig({ stores: { a: 'a.myshopify.com' } }, dir);
        const cfg = readClimaybeConfig(dir);
        assert.strictEqual(cfg.port, 9295);
        assert.deepStrictEqual(cfg.stores, { a: 'a.myshopify.com' });
      } finally {
        teardown();
      }
    });

    it('does not create package.json by default', () => {
      const dir = setup();
      try {
        writeConfig({ project_type: 'app' }, dir, { defaultPackageName: 'shopify-app' });
        assert.strictEqual(existsSync(join(dir, 'package.json')), false);
      } finally {
        teardown();
      }
    });

    it('can also write legacy package.json config when enabled', () => {
      const dir = setup();
      try {
        writeConfig({ project_type: 'app' }, dir, {
          defaultPackageName: 'shopify-app',
          alsoWriteLegacyPackageConfig: true,
        });
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
        assert.strictEqual(pkg.name, 'shopify-app');
        assert.strictEqual(pkg.config.project_type, 'app');
      } finally {
        teardown();
      }
    });
  });

  describe('migrateLegacyPackageConfigToClimaybe', () => {
    it('writes climaybe.config.json from package.json config when missing', () => {
      const dir = setup();
      try {
        const legacy = { port: 9295, stores: { a: 'a.myshopify.com' } };
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', config: legacy }), 'utf-8');
        const did = migrateLegacyPackageConfigToClimaybe({ cwd: dir });
        assert.strictEqual(did, true);
        assert.deepStrictEqual(readClimaybeConfig(dir), legacy);
      } finally {
        teardown();
      }
    });
  });

  describe('getProjectType', () => {
    it('returns theme when project_type missing or theme', () => {
      const dir = setup();
      try {
        assert.strictEqual(getProjectType(dir), 'theme');
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ config: { stores: { a: 'a.myshopify.com' } } }), 'utf-8');
        assert.strictEqual(getProjectType(dir), 'theme');
        writeConfig({ project_type: 'theme' }, dir);
        assert.strictEqual(getProjectType(dir), 'theme');
      } finally {
        teardown();
      }
    });

    it('returns app when project_type is app', () => {
      const dir = setup();
      try {
        writeConfig({ project_type: 'app' }, dir);
        assert.strictEqual(getProjectType(dir), 'app');
      } finally {
        teardown();
      }
    });
  });

  describe('isThemeProjectForAppInit', () => {
    it('returns false when no config', () => {
      const dir = setup();
      try {
        assert.strictEqual(isThemeProjectForAppInit(dir), false);
      } finally {
        teardown();
      }
    });

    it('returns true for legacy stores or project_type theme', () => {
      const dir = setup();
      try {
        writeConfig({ stores: { x: 'x.myshopify.com' } }, dir);
        assert.strictEqual(isThemeProjectForAppInit(dir), true);
        writeFileSync(
          join(dir, 'package.json'),
          JSON.stringify({ name: 't', config: { project_type: 'theme' } }),
          'utf-8'
        );
        assert.strictEqual(isThemeProjectForAppInit(dir), true);
      } finally {
        teardown();
      }
    });

    it('returns false for app project_type without stores', () => {
      const dir = setup();
      try {
        writeConfig({ project_type: 'app', commitlint: true }, dir);
        assert.strictEqual(isThemeProjectForAppInit(dir), false);
      } finally {
        teardown();
      }
    });
  });

  describe('getStoreAliases', () => {
    it('returns empty array when no config or no stores', () => {
      const dir = setup();
      try {
        assert.deepStrictEqual(getStoreAliases(dir), []);
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', config: {} }), 'utf-8');
        assert.deepStrictEqual(getStoreAliases(dir), []);
      } finally {
        teardown();
      }
    });

    it('returns keys of config.stores', () => {
      const dir = setup();
      try {
        writeConfig({ stores: { foo: 'f.myshopify.com', bar: 'b.myshopify.com' } }, dir);
        const aliases = getStoreAliases(dir);
        assert.strictEqual(aliases.length, 2);
        assert.ok(aliases.includes('foo'));
        assert.ok(aliases.includes('bar'));
      } finally {
        teardown();
      }
    });
  });

  describe('getMode', () => {
    it('returns single when one store', () => {
      const dir = setup();
      try {
        writeConfig({ stores: { foo: 'f.myshopify.com' } }, dir);
        assert.strictEqual(getMode(dir), 'single');
      } finally {
        teardown();
      }
    });

    it('returns multi when multiple stores', () => {
      const dir = setup();
      try {
        writeConfig({ stores: { foo: 'f.myshopify.com', bar: 'b.myshopify.com' } }, dir);
        assert.strictEqual(getMode(dir), 'multi');
      } finally {
        teardown();
      }
    });
  });

  describe('isPreviewWorkflowsEnabled', () => {
    it('returns false when not set or false', () => {
      const dir = setup();
      try {
        writeConfig({ stores: {} }, dir);
        assert.strictEqual(isPreviewWorkflowsEnabled(dir), false);
        writeConfig({ stores: {}, preview_workflows: false }, dir);
        assert.strictEqual(isPreviewWorkflowsEnabled(dir), false);
      } finally {
        teardown();
      }
    });

    it('returns true when preview_workflows is true', () => {
      const dir = setup();
      try {
        writeConfig({ stores: {}, preview_workflows: true }, dir);
        assert.strictEqual(isPreviewWorkflowsEnabled(dir), true);
      } finally {
        teardown();
      }
    });
  });

  describe('isBuildWorkflowsEnabled', () => {
    it('returns false when not set or false', () => {
      const dir = setup();
      try {
        writeConfig({ stores: {} }, dir);
        assert.strictEqual(isBuildWorkflowsEnabled(dir), false);
      } finally {
        teardown();
      }
    });

    it('returns true when build_workflows is true', () => {
      const dir = setup();
      try {
        writeConfig({ stores: {}, build_workflows: true }, dir);
        assert.strictEqual(isBuildWorkflowsEnabled(dir), true);
      } finally {
        teardown();
      }
    });
  });

  describe('isProfileWorkflowsEnabled', () => {
    it('returns false when not set or false', () => {
      const dir = setup();
      try {
        writeConfig({ stores: {} }, dir);
        assert.strictEqual(isProfileWorkflowsEnabled(dir), false);
      } finally {
        teardown();
      }
    });

    it('returns true when profile_workflows is true', () => {
      const dir = setup();
      try {
        writeConfig({ stores: {}, profile_workflows: true }, dir);
        assert.strictEqual(isProfileWorkflowsEnabled(dir), true);
      } finally {
        teardown();
      }
    });
  });

  describe('isCommitlintEnabled', () => {
    it('returns false when not set or false', () => {
      const dir = setup();
      try {
        writeConfig({ stores: {} }, dir);
        assert.strictEqual(isCommitlintEnabled(dir), false);
      } finally {
        teardown();
      }
    });

    it('returns true when commitlint is true', () => {
      const dir = setup();
      try {
        writeConfig({ stores: {}, commitlint: true }, dir);
        assert.strictEqual(isCommitlintEnabled(dir), true);
      } finally {
        teardown();
      }
    });
  });

  describe('isCursorSkillsEnabled', () => {
    it('returns false when not set or false', () => {
      const dir = setup();
      try {
        writeConfig({ stores: {} }, dir);
        assert.strictEqual(isCursorSkillsEnabled(dir), false);
      } finally {
        teardown();
      }
    });

    it('returns true when cursor_skills is true', () => {
      const dir = setup();
      try {
        writeConfig({ stores: {}, cursor_skills: true }, dir);
        assert.strictEqual(isCursorSkillsEnabled(dir), true);
      } finally {
        teardown();
      }
    });
  });

  describe('addStoreToConfig', () => {
    it('adds store and sets default_store when first', () => {
      const dir = setup();
      try {
        writeConfig({ port: 9295, stores: {} }, dir);
        const result = addStoreToConfig('myshop', 'myshop.myshopify.com', dir);
        assert.strictEqual(result.stores.myshop, 'myshop.myshopify.com');
        assert.strictEqual(result.default_store, 'myshop.myshopify.com');
      } finally {
        teardown();
      }
    });

    it('adds store without overwriting default_store when not first', () => {
      const dir = setup();
      try {
        writeConfig({
          port: 9295,
          default_store: 'first.myshopify.com',
          stores: { first: 'first.myshopify.com' },
        }, dir);
        const result = addStoreToConfig('second', 'second.myshopify.com', dir);
        assert.strictEqual(result.default_store, 'first.myshopify.com');
        assert.strictEqual(result.stores.second, 'second.myshopify.com');
      } finally {
        teardown();
      }
    });
  });
});
