import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMobileSharerContextFromUrl,
  mobileSharerDisplayLabel,
  hydrateMobileSharerSessionFromSettings,
} from './mobile-sharer-sync.mjs';
import { clinicalSessionContext } from './clinical-access-runtime.mjs';

describe('mobile-sharer-sync', () => {
  /** @type {typeof globalThis} */
  let g;
  beforeEach(() => {
    g = globalThis;
    g.window = {
      __RPC_MOBILE_WEB__: true,
      location: {
        search: '?name=Dr.%20Perez&rank=R1&sala=Sala%202&user=jperez&room=sala-2',
        origin: 'http://10.0.1.5:3738',
      },
    };
    g.document = { documentElement: { classList: { add() {}, contains() { return true; } } } };
    g.localStorage = {
      _data: {},
      getItem(k) {
        return this._data[k] ?? null;
      },
      setItem(k, v) {
        this._data[k] = v;
      },
    };
    clinicalSessionContext.user = null;
  });
  afterEach(() => {
    delete g.window;
    delete g.document;
    delete g.localStorage;
    clinicalSessionContext.user = null;
  });

  it('applyMobileSharerContextFromUrl persists identity and hydrates session', () => {
    const ok = applyMobileSharerContextFromUrl();
    assert.equal(ok, true);
    const s = JSON.parse(localStorage.getItem('rpc-settings'));
    assert.equal(s.clinicalDisplayName, 'Dr. Perez');
    assert.equal(s.clinicalRank, 'R1');
    assert.equal(s.clinicalSala, 'Sala 2');
    assert.equal(s.clinicalUsername, 'jperez');
    assert.equal(s.clinicalRegistered, true);
    hydrateMobileSharerSessionFromSettings();
    assert.equal(clinicalSessionContext.user?.username, 'jperez');
    assert.equal(mobileSharerDisplayLabel(), 'Dr. Perez');
  });
});
