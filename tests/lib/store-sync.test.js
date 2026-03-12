import { mkdtempSync, mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createStoreDirectories,
  storesToRoot,
  rootToStores,
} from '../../src/lib/store-sync.js';

describe('store-sync', () => {
  let cwd;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-sync-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  describe('createStoreDirectories', () => {
    it('creates stores/<alias>/config, templates, sections', () => {
      const dir = setup();
      try {
        createStoreDirectories('myshop', dir);
        assert.ok(existsSync(join(dir, 'stores', 'myshop', 'config')));
        assert.ok(existsSync(join(dir, 'stores', 'myshop', 'templates')));
        assert.ok(existsSync(join(dir, 'stores', 'myshop', 'sections')));
      } finally {
        teardown();
      }
    });
  });

  describe('storesToRoot', () => {
    it('returns false when store dir does not exist', () => {
      const dir = setup();
      try {
        const ok = storesToRoot('nonexistent', dir);
        assert.strictEqual(ok, false);
      } finally {
        teardown();
      }
    });

    it('copies JSON from stores/<alias>/ sync dirs to root', () => {
      const dir = setup();
      try {
        const storeDir = join(dir, 'stores', 'myshop', 'config');
        const storeConfig = join(storeDir, 'settings_data.json');
        mkdirSync(storeDir, { recursive: true });
        writeFileSync(storeConfig, '{"theme":1}', 'utf-8');
        const ok = storesToRoot('myshop', dir);
        assert.strictEqual(ok, true);
        const rootConfig = join(dir, 'config', 'settings_data.json');
        assert.ok(existsSync(rootConfig));
        assert.strictEqual(readFileSync(rootConfig, 'utf-8'), '{"theme":1}');
      } finally {
        teardown();
      }
    });
  });

  describe('rootToStores', () => {
    it('copies JSON from root sync dirs to stores/<alias>/', () => {
      const dir = setup();
      try {
        const rootConfig = join(dir, 'config');
        const rootFile = join(rootConfig, 'settings_data.json');
        mkdirSync(rootConfig, { recursive: true });
        writeFileSync(rootFile, '{"theme":2}', 'utf-8');
        createStoreDirectories('myshop', dir);
        rootToStores('myshop', dir);
        const storeFile = join(dir, 'stores', 'myshop', 'config', 'settings_data.json');
        assert.ok(existsSync(storeFile));
        assert.strictEqual(readFileSync(storeFile, 'utf-8'), '{"theme":2}');
      } finally {
        teardown();
      }
    });
  });
});
