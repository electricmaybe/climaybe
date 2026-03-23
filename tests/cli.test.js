import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createProgram } from '../src/index.js';

describe('CLI', () => {
  it('registers theme subgroup with init', () => {
    const program = createProgram();
    const theme = program.commands.find((c) => c.name() === 'theme');
    assert.ok(theme);
    const themeInit = theme.commands.find((c) => c.name() === 'init');
    assert.ok(themeInit);
    assert.strictEqual(themeInit.name(), 'init');
  });

  it('registers root init as shorthand for theme init', () => {
    const program = createProgram();
    const initCmd = program.commands.find((c) => c.name() === 'init');
    assert.ok(initCmd);
    assert.strictEqual(initCmd.name(), 'init');
  });

  it('registers theme reinit and root reinit', () => {
    const program = createProgram();
    const theme = program.commands.find((c) => c.name() === 'theme');
    assert.ok(theme.commands.find((c) => c.name() === 'reinit'));
    assert.ok(program.commands.find((c) => c.name() === 'reinit'));
  });

  it('registers theme and root add-store, switch, sync, ensure-branches, update-workflows', () => {
    const program = createProgram();
    const theme = program.commands.find((c) => c.name() === 'theme');
    const themeNames = theme.commands.map((c) => c.name());
    const rootNames = program.commands.map((c) => c.name());
    for (const name of ['add-store', 'switch', 'sync', 'ensure-branches', 'update-workflows']) {
      assert.ok(themeNames.includes(name), `theme ${name}`);
      assert.ok(rootNames.includes(name), `root ${name}`);
    }
  });

  it('registers app init', () => {
    const program = createProgram();
    const app = program.commands.find((c) => c.name() === 'app');
    assert.ok(app);
    const appInit = app.commands.find((c) => c.name() === 'init');
    assert.ok(appInit);
  });

  it('registers setup-commitlint and add-cursor at root only', () => {
    const program = createProgram();
    const names = program.commands.map((c) => c.name());
    assert.ok(names.includes('setup-commitlint'));
    assert.ok(names.includes('add-cursor'));
    const theme = program.commands.find((c) => c.name() === 'theme');
    assert.ok(!theme.commands.some((c) => c.name() === 'setup-commitlint'));
    const addCursor = program.commands.find((c) => c.name() === 'add-cursor');
    assert.ok(addCursor.aliases().includes('add-cursor-skill'));
  });
});
