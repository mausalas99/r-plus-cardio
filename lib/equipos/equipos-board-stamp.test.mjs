import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatBoardStamp } from './equipos-board-stamp.mjs';

describe('equipos-board-stamp', () => {
  it('formatBoardStamp changes when device custody changes', () => {
    const before = formatBoardStamp(
      { max_dev: '2026-07-02T10:00:00.000Z', in_use: 0 },
      { c: 1, max_j: '2026-07-02T09:00:00.000Z' },
      { c: 0, max_c: '' }
    );
    const after = formatBoardStamp(
      { max_dev: '2026-07-02T10:05:00.000Z', in_use: 1 },
      { c: 0, max_j: '' },
      { c: 0, max_c: '' }
    );
    assert.notEqual(before, after);
  });

  it('formatBoardStamp changes when waitlist order changes via skip event', () => {
    const shared = {
      max_dev: '2026-07-02T10:00:00.000Z',
      in_use: 1,
    };
    const wl = { c: 3, max_j: '2026-07-02T09:00:00.000Z' };
    const alerts = { c: 0, max_c: '' };
    const before = formatBoardStamp(shared, wl, alerts, { max_ev: '2026-07-02T10:01:00.000Z' });
    const after = formatBoardStamp(shared, wl, alerts, { max_ev: '2026-07-02T10:01:05.000Z' });
    assert.notEqual(before, after);
  });

  it('formatBoardStamp changes when previous holder clears', () => {
    const shared = { max_dev: '2026-07-02T10:00:00.000Z', in_use: 0 };
    const wl = { c: 0, max_j: '' };
    const alerts = { c: 0, max_c: '' };
    const before = formatBoardStamp(
      { ...shared, prev_count: 1, prev_sig: 'Ana|Sala 1' },
      wl,
      alerts
    );
    const after = formatBoardStamp(
      { ...shared, prev_count: 0, prev_sig: '|' },
      wl,
      alerts
    );
    assert.notEqual(before, after);
  });
});
