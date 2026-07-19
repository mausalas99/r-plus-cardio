'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  HOST_LAB_SET_CAP,
  emptySidecar,
  upsertLabSidecar,
  deleteLabSidecarSet,
  assembleLabHistory,
} = require('./lab-sidecar.js');

describe('lab-sidecar', () => {
  it('upsertLabSidecar does not call Array.sort on write path', () => {
    const src = fs.readFileSync(path.join(__dirname, 'lab-sidecar.js'), 'utf8');
    const upsertBlock = src.slice(src.indexOf('function upsertLabSidecar'), src.indexOf('function assembleLabHistory'));
    assert.doesNotMatch(upsertBlock, /Array\.sort/);
  });

  it('caps at HOST_LAB_SET_CAP with prepend/pop only', () => {
    let sc = emptySidecar();
    for (let i = 0; i < 25; i += 1) {
      sc = upsertLabSidecar(sc, { id: 's' + i, date: '2026-06-0' + (i % 9) }, i);
    }
    assert.strictEqual(sc.orderedIds.length, HOST_LAB_SET_CAP);
    assert.strictEqual(Object.keys(sc.setsById).length, HOST_LAB_SET_CAP);
    assert.strictEqual(sc.orderedIds[0], 's24');
    assert.strictEqual(sc.orderedIds[HOST_LAB_SET_CAP - 1], 's5');
  });

  it('reprocess same set id skips reorder', () => {
    let sc = emptySidecar();
    sc = upsertLabSidecar(sc, { id: 'a', date: '2026-06-01' }, 1);
    sc = upsertLabSidecar(sc, { id: 'b', date: '2026-06-02' }, 2);
    sc = upsertLabSidecar(sc, { id: 'c', date: '2026-06-03' }, 3);
    const before = [...sc.orderedIds];
    sc = upsertLabSidecar(sc, { id: 'b', date: '2026-06-02', values: { x: 1 } }, 4);
    assert.deepStrictEqual(sc.orderedIds, before);
    assert.strictEqual(sc.setsById.b.values.x, 1);
  });

  it('assembleLabHistory returns ordered sets', () => {
    let sc = emptySidecar();
    sc = upsertLabSidecar(sc, { id: 'x', date: '2026-06-01' }, 1);
    sc = upsertLabSidecar(sc, { id: 'y', date: '2026-06-02' }, 2);
    const hist = assembleLabHistory(sc);
    assert.strictEqual(hist.length, 2);
    assert.strictEqual(hist[0].id, 'y');
    assert.strictEqual(hist[1].id, 'x');
  });

  it('deleteLabSidecarSet removes set and blocks stale upsert', () => {
    let sc = emptySidecar();
    sc = upsertLabSidecar(sc, { id: 'a', date: '2026-06-01' }, 10);
    sc = upsertLabSidecar(sc, { id: 'b', date: '2026-06-02' }, 20);
    sc = deleteLabSidecarSet(sc, 'a', 30);
    assert.strictEqual(assembleLabHistory(sc).length, 1);
    assert.strictEqual(assembleLabHistory(sc)[0].id, 'b');
    sc = upsertLabSidecar(sc, { id: 'a', date: '2026-06-01' }, 25);
    assert.strictEqual(assembleLabHistory(sc).length, 1);
    sc = upsertLabSidecar(sc, { id: 'a', date: '2026-06-01', values: { x: 1 } }, 35);
    assert.strictEqual(assembleLabHistory(sc).length, 2);
  });
});
