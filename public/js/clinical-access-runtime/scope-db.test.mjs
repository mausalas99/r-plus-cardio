import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clinicalSessionContext } from '../clinical-session-context.mjs';
import { fetchClinicalScopeContextFromDb } from './scope-db.mjs';

test('fetchClinicalScopeContextFromDb preserves LAN scope when SQLCipher IPC is absent', async () => {
  const prevWindow = globalThis.window;
  globalThis.window = {};
  clinicalSessionContext.user = { user_id: 'u1' };
  clinicalSessionContext.scopeContext = {
    teams: [{ team_id: 't1', members: [{ user_id: 'u1' }] }],
    assignments: [{ patient_id: 'p1', team_id: 't1', effective_at: '2026-01-01T00:00:00.000Z' }],
    guardias: [],
  };
  try {
    const ctx = await fetchClinicalScopeContextFromDb();
    assert.equal(ctx, clinicalSessionContext.scopeContext);
    assert.equal(clinicalSessionContext.scopeContext.teams.length, 1);
  } finally {
    clinicalSessionContext.user = null;
    clinicalSessionContext.scopeContext = null;
    if (prevWindow) globalThis.window = prevWindow;
    else delete globalThis.window;
  }
});
