import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldApplyCommandBroadcast,
  updateCommandSeqState,
} from '../lan-command-room-order.mjs';

describe('LAN command room ordering', () => {
  it('applies next command when deltaSeq is contiguous', () => {
    assert.deepEqual(
      shouldApplyCommandBroadcast({ lastAppliedSeq: 4 }, { deltaSeq: 5, commandId: 'cmd_5' }),
      { action: 'apply' }
    );
  });

  it('ignores old command broadcasts', () => {
    assert.deepEqual(
      shouldApplyCommandBroadcast({ lastAppliedSeq: 5 }, { deltaSeq: 5, commandId: 'cmd_5' }),
      { action: 'ignore' }
    );
  });

  it('requires catch-up when command broadcast has a sequence gap', () => {
    assert.deepEqual(
      shouldApplyCommandBroadcast({ lastAppliedSeq: 4 }, { deltaSeq: 7, commandId: 'cmd_7' }),
      { action: 'catch_up', afterSeq: 4 }
    );
  });

  it('updates last applied sequence and last command id', () => {
    assert.deepEqual(
      updateCommandSeqState({ lastAppliedSeq: 4 }, { deltaSeq: 5, commandId: 'cmd_5' }),
      { lastAppliedSeq: 5, lastAckedCommandId: 'cmd_5' }
    );
  });
});
