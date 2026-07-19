import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_PATIENT_ID,
  DEMO_REGISTRO,
  adoptTourPatientOnCommit,
  DEMO_PATIENT_ID_2,
  getDemoPatientIdForRegistro,
  getTourDemoAdmitDefaults,
  isTourDemoRegistro,
  registerTourDemoPatientHooks,
  resolveTourDemoPatientId,
  shouldSelectTourPrimaryAfterLabCommit,
} from './tour-demo-patient.mjs';

test('isTourDemoRegistro reconoce registros del tour', () => {
  assert.equal(isTourDemoRegistro('0008421-7'), true);
  assert.equal(isTourDemoRegistro('0007755-3'), true);
  assert.equal(isTourDemoRegistro('1111111-1'), false);
});

test('resolveTourDemoPatientId por id fijo o registro', () => {
  assert.equal(
    resolveTourDemoPatientId([{ id: DEMO_PATIENT_ID, registro: DEMO_REGISTRO }]),
    DEMO_PATIENT_ID
  );
  assert.equal(
    resolveTourDemoPatientId([{ id: 'custom-id', registro: DEMO_REGISTRO }]),
    'custom-id'
  );
  assert.equal(resolveTourDemoPatientId([]), null);
});

test('adoptTourPatientOnCommit asigna id demo en tour activo', () => {
  var bundled = false;
  registerTourDemoPatientHooks({
    isTourActive: function () {
      return true;
    },
    getTourStep: function () {
      return 'lab_parse';
    },
    applyBundle: function () {
      bundled = true;
    },
    switchAppTab: function () {},
    showToast: function () {},
  });
  var patient = { id: 'temp', nombre: 'DEMO PÉREZ' };
  var result = adoptTourPatientOnCommit(patient, DEMO_REGISTRO);
  assert.equal(result.patient.id, DEMO_PATIENT_ID);
  assert.equal(result.patient.isDemo, true);
  assert.equal(typeof result.afterCommit, 'function');
  result.afterCommit(patient);
  assert.equal(bundled, true);
  assert.equal(getDemoPatientIdForRegistro(DEMO_REGISTRO), DEMO_PATIENT_ID);
});

test('getTourDemoAdmitDefaults sugiere cuarto y cama por registro demo', () => {
  registerTourDemoPatientHooks({ isTourActive: function () { return true; } });
  assert.deepEqual(getTourDemoAdmitDefaults(DEMO_REGISTRO), {
    servicio: 'MEDICINA INTERNA',
    cuarto: '214',
    cama: '2',
  });
  assert.deepEqual(getTourDemoAdmitDefaults('0007755-3'), {
    servicio: 'MEDICINA INTERNA',
    cuarto: '214',
    cama: '4',
  });
  assert.equal(getTourDemoAdmitDefaults('9999999-9'), null);
  registerTourDemoPatientHooks({ isTourActive: function () { return false; } });
  assert.equal(getTourDemoAdmitDefaults(DEMO_REGISTRO), null);
});

test('shouldSelectTourPrimaryAfterLabCommit solo tras alta de García', () => {
  registerTourDemoPatientHooks({ isTourActive: function () { return true; } });
  var list = [
    { id: DEMO_PATIENT_ID, registro: DEMO_REGISTRO },
    { id: DEMO_PATIENT_ID_2, registro: '0007755-3' },
  ];
  assert.equal(shouldSelectTourPrimaryAfterLabCommit(DEMO_PATIENT_ID_2, list), true);
  assert.equal(shouldSelectTourPrimaryAfterLabCommit(DEMO_PATIENT_ID, list), false);
});
