import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSafetyBundleEntries,
  TYPED_ENTRY_FIELDS,
} from './lan-safety-bundle-builder.mjs';

describe('buildSafetyBundleEntries', () => {
  const mkEntry = (id, overrides = {}) => ({
    id,
    name: 'Test Patient',
    note: { texto: 'SOAP note text' },
    indicaciones: { items: ['paracetamol'] },
    labHistory: [{ id: 'ls_1', date: '2026-06-07', values: {} }],
    todos: [{ id: 't1', text: 'check labs' }],
    medReceta: { meds: [{ name: 'amox' }] },
    vpo: { text: 'some vpo content' },
    ...overrides,
  });

  it('strips typed fields from each entry', () => {
    const entries = buildSafetyBundleEntries([mkEntry('p1')]);
    assert.equal(entries.length, 1);
    assert.ok(!('note' in entries[0]), 'note must be stripped');
    assert.ok(!('indicaciones' in entries[0]), 'indicaciones must be stripped');
    assert.ok(!('labHistory' in entries[0]), 'labHistory must be stripped');
    assert.ok(!('todos' in entries[0]), 'todos must be stripped');
  });

  it('preserves untyped fields', () => {
    const entries = buildSafetyBundleEntries([mkEntry('p1')]);
    assert.ok('medReceta' in entries[0], 'medReceta must be preserved');
    assert.ok('vpo' in entries[0], 'vpo must be preserved');
    assert.ok('name' in entries[0], 'name must be preserved');
    assert.ok('id' in entries[0], 'id must be preserved');
  });

  it('only includes entries listed in dirtyPatientIds', () => {
    const entries = buildSafetyBundleEntries(
      [mkEntry('p1'), mkEntry('p2'), mkEntry('p3')],
      new Set(['p2'])
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, 'p2');
  });

  it('includes all entries when dirtyPatientIds is not provided', () => {
    const entries = buildSafetyBundleEntries([mkEntry('p1'), mkEntry('p2')]);
    assert.equal(entries.length, 2);
  });

  it('TYPED_ENTRY_FIELDS exports the expected set', () => {
    for (const f of ['note', 'indicaciones', 'labHistory', 'todos']) {
      assert.ok(TYPED_ENTRY_FIELDS.has(f), `TYPED_ENTRY_FIELDS must include ${f}`);
    }
  });
});
