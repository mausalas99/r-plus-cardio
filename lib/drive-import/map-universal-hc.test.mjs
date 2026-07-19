import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapUniversalHc, hasDriveHcSections } from './map-universal-hc.mjs';

test('mapUniversalHc merges ficha and pipe sections', () => {
  const doc = {
    sections: {
      ficha: 'NOMBRE: TEST\nSEXO: MASCULINO',
      app: 'DIABETES',
      historiaClinica: 'ORIGEN: MTY',
      peea: 'NARRATIVA',
    },
  };
  assert.ok(hasDriveHcSections(doc.sections));
  const patch = mapUniversalHc(doc);
  assert.ok(patch.padecimientoActual);
  assert.ok(patch.app);
});

test('mapUniversalHc returns empty without HC sections', () => {
  const patch = mapUniversalHc({ sections: {} });
  assert.equal(Object.keys(patch).length, 0);
});
