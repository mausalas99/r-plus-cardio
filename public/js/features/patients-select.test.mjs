import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/** Mirrors selectPatientCore patientChanged detection. */
function patientChanged(prevId, id) {
  return String(prevId ?? '') !== String(id);
}

/** Mirrors list refresh branch in selectPatientCore. */
function shouldFullRenderPatientList(patientChanged, patchHighlightOk) {
  return !patientChanged || !patchHighlightOk;
}

describe('selectPatient patientChanged', () => {
  it('is true when selecting the first patient from empty state', () => {
    assert.equal(patientChanged(null, 'abc'), true);
    assert.equal(patientChanged(undefined, 'abc'), true);
  });

  it('is true when switching between patients', () => {
    assert.equal(patientChanged('a', 'b'), true);
  });

  it('is false when re-selecting the same patient', () => {
    assert.equal(patientChanged('a', 'a'), false);
    assert.equal(patientChanged(12, '12'), false);
  });
});

describe('selectPatient list refresh branch', () => {
  it('re-renders list when re-selecting the same patient', () => {
    assert.equal(shouldFullRenderPatientList(false, true), true);
  });

  it('re-renders list when highlight patch cannot run silently', () => {
    assert.equal(shouldFullRenderPatientList(true, false), true);
  });
});
