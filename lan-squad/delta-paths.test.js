'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeDeltaPath,
  validateDeltaPaths,
  applyPathValue,
} = require('./delta-paths.js');

test('normalizeDeltaPath trims and rejects prototype pollution segments', () => {
  assert.equal(normalizeDeltaPath(' labsAtAdmission.na '), 'labsAtAdmission.na');
  assert.throws(() => normalizeDeltaPath('__proto__.isAdmin'), /unsafe_path/);
  assert.throws(() => normalizeDeltaPath('meta.constructor.value'), /unsafe_path/);
  assert.throws(() => normalizeDeltaPath('meta.prototype.value'), /unsafe_path/);
});

test('validateDeltaPaths rejects numeric array index paths', () => {
  const result = validateDeltaPaths('historiaClinica', {
    pathValues: { 'plan.0.text': 'wrong target' },
    pathMeta: { 'plan.0.text': { clientTimestamp: 1718293049283 } },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'invalid_delta');
  assert.deepEqual(result.rejectedPaths, ['plan.0.text']);
});

test('validateDeltaPaths accepts allowlisted historiaClinica scalar paths and null clears', () => {
  const result = validateDeltaPaths('historiaClinica', {
    pathValues: {
      'labsAtAdmission.na': null,
      'signosVitalesIngreso.fc': '88',
    },
    pathMeta: {
      'labsAtAdmission.na': { clientTimestamp: 1718293049283 },
      'signosVitalesIngreso.fc': { clientTimestamp: 1718293049290 },
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.paths, ['labsAtAdmission.na', 'signosVitalesIngreso.fc']);
});

test('validateDeltaPaths rejects unknown entity and missing path metadata', () => {
  assert.equal(
    validateDeltaPaths('patient', {
      pathValues: { nombre: 'No v1' },
      pathMeta: { nombre: { clientTimestamp: 1 } },
    }).error,
    'unsupported_entity'
  );

  const result = validateDeltaPaths('todo', {
    pathValues: { text: 'pendiente' },
    pathMeta: {},
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'missing_path_meta');
  assert.deepEqual(result.rejectedPaths, ['text']);
});

test('applyPathValue sets nested fields and deletes null leaves', () => {
  const data = { labsAtAdmission: { na: 138, k: 4.1 } };
  applyPathValue(data, 'labsAtAdmission.na', 140);
  assert.equal(data.labsAtAdmission.na, 140);
  applyPathValue(data, 'labsAtAdmission.na', null);
  assert.equal(Object.prototype.hasOwnProperty.call(data.labsAtAdmission, 'na'), false);
  assert.equal(data.labsAtAdmission.k, 4.1);
});
