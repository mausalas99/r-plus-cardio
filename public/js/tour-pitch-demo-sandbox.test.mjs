import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearPitchDemo,
  markPitchTourSessionActive,
  resolvePitchPersistPatients,
  seedPitchDemo,
  setPitchPatientIsolation,
} from './tour-pitch-demo-seed.mjs';
import { patients, setPatients } from './app-state.mjs';

const PITCH_SANDBOX_SS_KEY = 'rpc-pitch-tour-sandbox-v1';
const PITCH_TOUR_ACTIVE_SS_KEY = 'rpc-pitch-tour-active';

/** @type {Map<string, string>} */
const ss = new Map();

/** @type {Map<string, string>} */
const ls = new Map();

function installBrowserStorageMocks() {
  globalThis.sessionStorage = {
    getItem(key) {
      return ss.has(key) ? ss.get(key) : null;
    },
    setItem(key, value) {
      ss.set(key, String(value));
    },
    removeItem(key) {
      ss.delete(key);
    },
  };
  globalThis.localStorage = {
    getItem(key) {
      return ls.has(key) ? ls.get(key) : null;
    },
    setItem(key, value) {
      ls.set(key, String(value));
    },
    removeItem(key) {
      ls.delete(key);
    },
  };
}

function makeState() {
  return {
    patients,
    notes: {},
    indicaciones: {},
    labHistory: {},
    listadoProblemas: {},
    medRecetaByPatient: {},
    medNotaSelectionByPatient: {},
    recetaHuByPatient: {},
    setPatients,
    saveState() {},
    renderPatientList() {},
    selectPatient() {},
    getActiveId() {
      return null;
    },
    setActiveId() {},
  };
}

beforeEach(() => {
  installBrowserStorageMocks();
  ss.clear();
  ls.clear();
  ls.set('rpc-scheduled-procedures', '[]');
  setPitchPatientIsolation(false);
  setPatients([
    { id: 'real-a', nombre: 'Paciente A' },
    { id: 'real-b', nombre: 'Paciente B' },
  ]);
});

afterEach(() => {
  ss.clear();
  ls.clear();
  setPitchPatientIsolation(false);
  clearPitchDemo(makeState());
});

test('seedPitchDemo guarda respaldo en sessionStorage y resolvePitchPersistPatients devuelve reales', () => {
  const state = makeState();
  markPitchTourSessionActive(true);
  seedPitchDemo(state);
  assert.equal(patients.length, 1);
  assert.equal(patients[0].id, 'demo-pitch');

  const raw = sessionStorage.getItem(PITCH_SANDBOX_SS_KEY);
  assert.ok(raw);
  const sandbox = JSON.parse(raw);
  assert.equal(sandbox.patients.length, 2);
  assert.equal(sandbox.patients[0].id, 'real-a');

  const forPersist = resolvePitchPersistPatients();
  assert.ok(forPersist);
  assert.equal(forPersist.length, 2);
  assert.equal(forPersist[0].id, 'real-a');
});

test('clearPitchDemo never leaves empty list when sandbox had real patients', () => {
  const state = makeState();
  seedPitchDemo(state);
  setPatients([]);
  setPitchPatientIsolation(true);
  clearPitchDemo(state);
  assert.ok(patients.length >= 2);
  assert.equal(patients[0].id, 'real-a');
});

test('clearPitchDemo restaura pacientes reales aunque el respaldo en memoria se perdió', () => {
  const state = makeState();
  seedPitchDemo(state);
  sessionStorage.setItem(PITCH_TOUR_ACTIVE_SS_KEY, '1');

  setPatients([{ id: 'demo-pitch', nombre: 'DEMO' }]);
  setPitchPatientIsolation(false);

  clearPitchDemo(state);
  assert.equal(patients.length, 2);
  assert.equal(patients[0].id, 'real-a');
  assert.equal(sessionStorage.getItem(PITCH_SANDBOX_SS_KEY), null);
});
