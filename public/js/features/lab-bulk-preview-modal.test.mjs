import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const {
  resolveBulkPreviewConfirmState,
  shouldOfferBulkPreviewAddPatient,
  hasPendingBulkLabPreviewSession,
} = await import('./lab-bulk-preview-modal.mjs');

describe('resolveBulkPreviewConfirmState', () => {
  it('permite confirmar cuando hay reportes válidos sin paciente en lista', () => {
    var state = resolveBulkPreviewConfirmState([
      { status: 'no-patient', okReportCount: 2, canProcess: false },
    ]);
    assert.equal(state.processable, false);
    assert.equal(state.displayable, true);
    assert.equal(state.canConfirm, true);
  });

  it('permite confirmar con varios bloques sin pacientes registrados', () => {
    var state = resolveBulkPreviewConfirmState([
      { status: 'no-patient', okReportCount: 1, canProcess: false },
      { status: 'no-patient', okReportCount: 1, canProcess: false },
    ]);
    assert.equal(state.canConfirm, true);
  });

  it('bloquea confirmar cuando no hay reportes parseables', () => {
    var state = resolveBulkPreviewConfirmState([
      { status: 'parse-errors', okReportCount: 0, canProcess: false },
    ]);
    assert.equal(state.displayable, false);
    assert.equal(state.canConfirm, false);
  });

  it('marca processable cuando el expediente está en la lista', () => {
    var state = resolveBulkPreviewConfirmState([
      {
        status: 'ok',
        okReportCount: 2,
        canProcess: true,
        patient: { id: 'p1' },
      },
    ]);
    assert.equal(state.processable, true);
    assert.equal(state.canConfirm, true);
  });
});

describe('shouldOfferBulkPreviewAddPatient', () => {
  it('ofrece alta cuando el bloque parseó labs pero no hay paciente', () => {
    assert.equal(
      shouldOfferBulkPreviewAddPatient({ status: 'no-patient', okReportCount: 2 }),
      true
    );
  });

  it('no ofrece alta cuando el paciente ya está en lista', () => {
    assert.equal(
      shouldOfferBulkPreviewAddPatient({ status: 'ok', okReportCount: 2, canProcess: true }),
      false
    );
  });

  it('no ofrece alta sin reportes válidos', () => {
    assert.equal(
      shouldOfferBulkPreviewAddPatient({ status: 'no-patient', okReportCount: 0 }),
      false
    );
  });
});

describe('hasPendingBulkLabPreviewSession', () => {
  it('is false without an open modal session', () => {
    assert.equal(hasPendingBulkLabPreviewSession(), false);
  });
});
