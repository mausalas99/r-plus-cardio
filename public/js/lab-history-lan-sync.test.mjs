import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  pushLabHistoryDeleteToLan,
  pushLabHistorySetToLan,
  syncLabHistoryConsolidationToLan,
} from './lab-history-lan-sync.mjs';
import { labHistory } from './app-state.mjs';

describe('lab-history-lan-sync', () => {
  it('stamps keeper sets before LAN dispatch', () => {
    labHistory.p1 = [{ id: 'keep', fecha: '01/01/2026', resLabs: ['Hb 10'] }];
    syncLabHistoryConsolidationToLan('p1', {
      keeperIds: ['keep'],
      removedIds: ['gone-a'],
    });
    assert.ok(Number(labHistory.p1[0]._clientTimestamp) > 0);
    delete labHistory.p1;
  });

  it('push helpers accept minimal payloads without throwing', () => {
    assert.doesNotThrow(function () {
      pushLabHistorySetToLan('p2', { id: 's1', resLabs: ['Na 140'] });
      pushLabHistoryDeleteToLan('p2', 's1');
      pushLabHistorySetToLan('', null);
      pushLabHistoryDeleteToLan('', '');
    });
  });
});
