import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toClinicalHistoryText, applyClinicalHistoryUppercase } from './clinical-text.mjs';

test('toClinicalHistoryText uppercases', () => {
  assert.equal(toClinicalHistoryText('diabetes mellitus'), 'DIABETES MELLITUS');
});

test('applyClinicalHistoryUppercase preserves condition ids', () => {
  const data = {
    motivoConsulta: 'dolor abdominal',
    app: { conditions: ['dm', 'hta'], descripcionDetallada: 'dm2 dx 2010' },
  };
  applyClinicalHistoryUppercase(data);
  assert.deepEqual(data.app.conditions, ['dm', 'hta']);
  assert.equal(data.motivoConsulta, 'DOLOR ABDOMINAL');
  assert.equal(data.app.descripcionDetallada, 'DM2 DX 2010');
});

test('applyClinicalHistoryUppercase preserves habit status codes', () => {
  const apnp = { tabaquismoDetail: { status: 'negado' }, alcoholismoDetail: { status: 'activo' } };
  applyClinicalHistoryUppercase(apnp);
  assert.equal(apnp.tabaquismoDetail.status, 'negado');
  assert.equal(apnp.alcoholismoDetail.status, 'activo');
});
