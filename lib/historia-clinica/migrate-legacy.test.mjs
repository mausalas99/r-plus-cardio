import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyHistoriaData } from './migrate-legacy.mjs';

test('migrateLegacy maps flat app into app.descripcionDetallada', () => {
  const out = migrateLegacyHistoriaData({
    patientId: 'p1',
    ficha: 'Juan, 49 años',
    app: 'Metformina. DM2.',
    ahf: 'Madre DM',
    apnp: 'Tabaco negado',
    peea: 'Ingreso por sangrado',
  });
  assert.equal(out.app.descripcionDetallada, 'Metformina. DM2.');
  assert.equal(out.padecimientoActual, 'Ingreso por sangrado');
  assert.equal(out.ficha, undefined);
});
