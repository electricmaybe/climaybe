import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadSharedManual,
  loadManualFile,
  mergeManualLists,
  selectManualItems,
  renderManualChecklistComment,
  parseManualChecklistProgress,
  buildManualChecklist,
} from '../../src/qa/lib/manual.js';
import { parseYamlLite } from '../../src/qa/lib/yaml-lite.js';

describe('store QA manual merge', () => {
  it('parses shared manual YAML', () => {
    const shared = loadSharedManual();
    assert.ok(shared.items.length >= 5);
    assert.ok(shared.items.some((i) => i.id === 'M01'));
  });

  it('yaml-lite parses nested maps and lists', () => {
    const doc = parseYamlLite(`
version: 1
items:
  - id: X1
    title: Hello
    when: [car, pdp]
    required_on: [release]
`);
    assert.equal(doc.version, 1);
    assert.equal(doc.items[0].id, 'X1');
    assert.deepEqual(doc.items[0].when, ['car', 'pdp']);
  });

  it('merges project items over shared by id', () => {
    const merged = mergeManualLists(
      [{ id: 'M01', title: 'Shared title', when: ['pdp'] }],
      [{ id: 'M01', title: 'Override', when: ['pdp'] }, { id: 'V-M01', title: 'Project only' }]
    );
    assert.equal(merged.find((i) => i.id === 'M01').title, 'Override');
    assert.equal(merged.find((i) => i.id === 'M01').source, 'project');
    assert.ok(merged.some((i) => i.id === 'V-M01'));
  });

  it('selects manual items by area tags for small scope', () => {
    const items = [
      { id: 'M01', title: 'Gallery', when: ['gallery', 'pdp'], required_on: ['release'] },
      { id: 'M05', title: 'Forms', when: ['forms'], required_on: ['release'] },
      { id: 'M06', title: 'Editor', when: ['templates'], required_on: ['release', 'medium'] },
    ];
    const selected = selectManualItems(items, {
      scope: 'small',
      tags: ['@pdp', '@gallery'],
      manualIds: ['M01'],
    });
    assert.ok(selected.some((i) => i.id === 'M01'));
    assert.equal(selected.some((i) => i.id === 'M05'), false);
  });

  it('includes release-required items on release scope', () => {
    const shared = loadSharedManual().items;
    const selected = selectManualItems(shared, { scope: 'release', tags: [] });
    assert.ok(selected.length >= 5);
    assert.ok(selected.some((i) => i.id === 'M01'));
  });

  it('renders a task-list comment with marker', () => {
    const md = renderManualChecklistComment(
      [{ id: 'M01', title: 'Swipe gallery', expected: 'Snap', devices: ['iphone'] }],
      { headSha: 'abc1234', scope: 'medium' }
    );
    assert.match(md, /<!-- climaybe-qa-manual -->/);
    assert.match(md, /- \[ \] \*\*M01\*\*/);
    assert.match(md, /Expected: Snap/);
  });

  it('parses checklist progress', () => {
    const body = `<!-- climaybe-qa-manual -->
- [x] **M01**: done
- [ ] **M02**: todo
`;
    const progress = parseManualChecklistProgress(body);
    assert.equal(progress.total, 2);
    assert.equal(progress.checked, 1);
    assert.equal(progress.complete, false);
    assert.deepEqual(progress.uncheckedIds, ['M02']);
  });

  it('buildManualChecklist merges project file from disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'climaybe-manual-'));
    try {
      const path = join(dir, 'manual.yml');
      writeFileSync(
        path,
        `version: 1\nitems:\n  - id: V-M01\n    title: Car float\n    when: [car]\n    required_on: [release]\n`,
        'utf-8'
      );
      const built = buildManualChecklist({
        projectManualPath: path,
        selection: { scope: 'release', tags: ['@car'], headSha: 'deadbeef' },
      });
      assert.ok(built.selected.some((i) => i.id === 'V-M01'));
      assert.match(built.comment, /V-M01/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loadManualFile returns empty for missing path', () => {
    assert.deepEqual(loadManualFile('/no/such/manual.yml'), { items: [] });
  });
});
