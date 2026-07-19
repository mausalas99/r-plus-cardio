import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clinicalSessionContext } from '../clinical-session-context.mjs';
import { isClinicalScopeReadyForLanPatientApply } from './scope-lan.mjs';

function mockDesktopElectron() {
  globalThis.window = {
    electronAPI: { dbClinicalLoadAll: async () => ({ ok: true, blobs: {} }) },
  };
}

function mockMobileWeb() {
  globalThis.__RPC_MOBILE_WEB__ = true;
  globalThis.window = {};
}

beforeEach(() => {
  mockDesktopElectron();
  clinicalSessionContext.user = { user_id: 'u1', rank: 'R1', username: 'r1doc' };
  clinicalSessionContext.scopeContext = null;
});

afterEach(() => {
  clinicalSessionContext.user = null;
  clinicalSessionContext.scopeContext = null;
  delete globalThis.window;
  delete globalThis.__RPC_MOBILE_WEB__;
});

describe('isClinicalScopeReadyForLanPatientApply', () => {
  it('allows desktop LAN push/apply before scopeContext hydrate', () => {
    assert.equal(isClinicalScopeReadyForLanPatientApply(), true);
  });

  it('blocks iPad until user has a joined team in LAN scope', () => {
    mockMobileWeb();
    assert.equal(isClinicalScopeReadyForLanPatientApply(), false);
    clinicalSessionContext.scopeContext = {
      teams: [
        {
          team_id: 'team-a',
          members: [{ user_id: 'u1', username: 'r1doc' }],
        },
      ],
      assignments: [],
      guardias: [],
    };
    assert.equal(isClinicalScopeReadyForLanPatientApply(), true);
  });
});
