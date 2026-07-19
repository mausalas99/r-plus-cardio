import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patients, notes, setPatients } from '../app-state.mjs';
import { clinicalSessionContext } from '../clinical-session-context.mjs';
import { pruneMobilePatientsOutsideTeamScope } from './mobile.mjs';

test('pruneMobilePatientsOutsideTeamScope keeps census while LAN scope is loading', () => {
  const g = globalThis;
  const prevMobile = g.__RPC_MOBILE_WEB__;
  g.__RPC_MOBILE_WEB__ = true;
  try {
    setPatients([{ id: 'p1', nombre: 'TEST', registro: 'R1' }]);
    notes.p1 = { fecha: '01/01/2026' };
    clinicalSessionContext.user = { user_id: 'u1', rank: 'R1' };
    clinicalSessionContext.scopeContext = null;

    const pruned = pruneMobilePatientsOutsideTeamScope();
    assert.equal(pruned, 0);
    assert.equal(patients.length, 1);
    assert.ok(notes.p1);
  } finally {
    setPatients([]);
    delete notes.p1;
    clinicalSessionContext.user = null;
    clinicalSessionContext.scopeContext = null;
    if (prevMobile) g.__RPC_MOBILE_WEB__ = prevMobile;
    else delete g.__RPC_MOBILE_WEB__;
  }
});
