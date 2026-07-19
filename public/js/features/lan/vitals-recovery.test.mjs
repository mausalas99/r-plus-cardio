import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { scanMonitoreoRecoveryCandidates, recoverMonitoreoFromLanCache } from './vitals-recovery.mjs';
import { setPatients } from '../../app-state.mjs';

const OUTBOX_KEY = 'rpc-lan-sync-outbox';

function mkMonEntry(pid, reg, histIds) {
  return {
    patient: {
      id: pid,
      registro: reg,
      nombre: 'PACIENTE TEST',
      monitoreo: {
        historial: histIds.map(function (id, idx) {
          return {
            id: id,
            recordedAt: '2026-06-27T1' + idx + ':00:00.000Z',
            vitals: { tas: 120 + idx },
          };
        }),
        textoGuardado: { text: '', savedAt: null },
        estadoClinico: {},
        confirmado: {},
        pendienteReceta: {},
      },
    },
    note: {},
    labHistory: [],
  };
}

describe('vitals-recovery', () => {
  const store = new Map();

  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      getItem(k) {
        return store.has(k) ? store.get(k) : null;
      },
      setItem(k, v) {
        store.set(k, String(v));
      },
      removeItem(k) {
        store.delete(k);
      },
    };
    setPatients([{ id: 'p1', nombre: 'PACIENTE TEST', registro: 'R-100', monitoreo: undefined }]);
  });

  afterEach(() => {
    setPatients([]);
    delete globalThis.localStorage;
  });

  it('finds monitoreo in LAN outbox bundles', () => {
    store.set(
      OUTBOX_KEY,
      JSON.stringify({
        'sala-2': [
          {
            kind: 'bundle',
            payload: { entries: [mkMonEntry('p1', 'R-100', ['v1', 'v2'])] },
          },
        ],
      })
    );
    var scan = scanMonitoreoRecoveryCandidates('sala-2');
    assert.ok(scan.byKey.size >= 1);
    assert.equal(scan.sources.outbox, 1);
  });

  it('restores historial from outbox into live patient', () => {
    store.set(
      OUTBOX_KEY,
      JSON.stringify({
        'sala-2': [
          {
            kind: 'bundle',
            payload: { entries: [mkMonEntry('p1', 'R-100', ['v1', 'v2'])] },
          },
        ],
      })
    );
    var result = recoverMonitoreoFromLanCache({ roomId: 'sala-2', dryRun: true });
    assert.equal(result.restored, 1);
    assert.equal(result.details[0].after, 2);
  });
});
