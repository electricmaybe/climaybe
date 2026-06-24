import { mkdtempSync, mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { prepareMultiStoreForServe } from '../../src/lib/serve-multi-store.js';
import { writeConfig, readConfig } from '../../src/lib/config.js';

describe('serve-multi-store', () => {
  let cwd;
  let prevServeStore;

  function setup() {
    cwd = mkdtempSync(join(tmpdir(), 'climaybe-serve-ms-'));
    return cwd;
  }

  function teardown() {
    if (cwd && existsSync(cwd)) rmSync(cwd, { recursive: true });
  }

  before(() => {
    prevServeStore = process.env.CLIMAYBE_SERVE_STORE;
    delete process.env.CLIMAYBE_SERVE_STORE;
  });

  after(() => {
    if (prevServeStore === undefined) delete process.env.CLIMAYBE_SERVE_STORE;
    else process.env.CLIMAYBE_SERVE_STORE = prevServeStore;
  });

  it('returns true in single-store mode without touching files', async () => {
    const dir = setup();
    try {
      writeConfig({ stores: { only: 'only.myshopify.com' }, default_store: 'only.myshopify.com' }, dir);
      const ok = await prepareMultiStoreForServe(dir);
      assert.strictEqual(ok, true);
    } finally {
      teardown();
    }
  });

  it('when switching serve target, saves root JSONs to previous store then loads selected store', async () => {
    const dir = setup();
    try {
      writeConfig(
        {
          stores: { storea: 'a.myshopify.com', storeb: 'b.myshopify.com' },
          default_store: 'a.myshopify.com',
        },
        dir
      );
      const rootCfg = join(dir, 'config');
      mkdirSync(join(dir, 'stores', 'storea', 'config'), { recursive: true });
      mkdirSync(join(dir, 'stores', 'storeb', 'config'), { recursive: true });
      writeFileSync(join(dir, 'stores', 'storea', 'config', 'settings_data.json'), '{"from":"a"}', 'utf-8');
      writeFileSync(join(dir, 'stores', 'storeb', 'config', 'settings_data.json'), '{"from":"b"}', 'utf-8');
      mkdirSync(rootCfg, { recursive: true });
      writeFileSync(join(rootCfg, 'settings_data.json'), '{"edited":true}', 'utf-8');

      process.env.CLIMAYBE_SERVE_STORE = 'storeb';
      const ok = await prepareMultiStoreForServe(dir);
      assert.strictEqual(ok, true);

      assert.strictEqual(
        readFileSync(join(dir, 'stores', 'storea', 'config', 'settings_data.json'), 'utf-8'),
        '{"edited":true}'
      );
      assert.strictEqual(readFileSync(join(rootCfg, 'settings_data.json'), 'utf-8'), '{"from":"b"}');
      assert.strictEqual(readConfig(dir).default_store, 'b.myshopify.com');
    } finally {
      delete process.env.CLIMAYBE_SERVE_STORE;
      teardown();
    }
  });

  it('returns false when CLIMAYBE_SERVE_STORE is not a known alias', async () => {
    const dir = setup();
    try {
      writeConfig(
        {
          stores: { storea: 'a.myshopify.com', storeb: 'b.myshopify.com' },
          default_store: 'a.myshopify.com',
        },
        dir
      );
      process.env.CLIMAYBE_SERVE_STORE = 'nope';
      const ok = await prepareMultiStoreForServe(dir);
      assert.strictEqual(ok, false);
    } finally {
      delete process.env.CLIMAYBE_SERVE_STORE;
      teardown();
    }
  });

  it('when explicit store matches default_store, does not overwrite root from store dir', async () => {
    const dir = setup();
    try {
      writeConfig(
        {
          stores: { storea: 'a.myshopify.com', storeb: 'b.myshopify.com' },
          default_store: 'a.myshopify.com',
        },
        dir
      );
      const rootCfg = join(dir, 'config');
      mkdirSync(join(dir, 'stores', 'storea', 'config'), { recursive: true });
      mkdirSync(join(dir, 'stores', 'storeb', 'config'), { recursive: true });
      writeFileSync(join(dir, 'stores', 'storea', 'config', 'settings_data.json'), '{"from":"a"}', 'utf-8');
      writeFileSync(join(dir, 'stores', 'storeb', 'config', 'settings_data.json'), '{"from":"b"}', 'utf-8');
      mkdirSync(rootCfg, { recursive: true });
      writeFileSync(join(rootCfg, 'settings_data.json'), '{"localOnly":true}', 'utf-8');

      process.env.CLIMAYBE_SERVE_STORE = 'storea';
      const ok = await prepareMultiStoreForServe(dir);
      assert.strictEqual(ok, true);
      assert.strictEqual(readFileSync(join(rootCfg, 'settings_data.json'), 'utf-8'), '{"localOnly":true}');
    } finally {
      delete process.env.CLIMAYBE_SERVE_STORE;
      teardown();
    }
  });
});
