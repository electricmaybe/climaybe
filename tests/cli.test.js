import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createProgram } from '../src/index.js';

describe('CLI', () => {
  it('registers init command', () => {
    const program = createProgram();
    const initCmd = program.commands.find((c) => c.name() === 'init');
    assert.ok(initCmd);
    assert.strictEqual(initCmd.name(), 'init');
  });

  it('registers reinit command', () => {
    const program = createProgram();
    const reinitCmd = program.commands.find((c) => c.name() === 'reinit');
    assert.ok(reinitCmd);
  });

  it('registers add-store, switch, sync, ensure-branches, update-workflows, setup-commitlint, add-cursor-skill', () => {
    const program = createProgram();
    const names = program.commands.map((c) => c.name());
    assert.ok(names.includes('init'));
    assert.ok(names.includes('reinit'));
    assert.ok(names.includes('add-store'));
    assert.ok(names.includes('switch'));
    assert.ok(names.includes('sync'));
    assert.ok(names.includes('ensure-branches'));
    assert.ok(names.includes('update-workflows'));
    assert.ok(names.includes('setup-commitlint'));
    assert.ok(names.includes('add-cursor-skill'));
  });
});
