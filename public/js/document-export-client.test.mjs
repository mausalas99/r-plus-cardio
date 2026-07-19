import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canGenerateDocumentsOffline,
  guardDocExportBlocked,
  isDocExportBlockedByLocalServer,
  parseContentDispositionFilename,
} from './document-export-client.mjs';

describe('offline document export guards', () => {
  it('isDocExportBlockedByLocalServer is false when IPC is available', () => {
    const prev = globalThis.window;
    globalThis.window = { electronAPI: { generateDocument() {} } };
    try {
      assert.equal(isDocExportBlockedByLocalServer(true), false);
      assert.equal(canGenerateDocumentsOffline(), true);
    } finally {
      globalThis.window = prev;
    }
  });

  it('guardDocExportBlocked blocks only without IPC', () => {
    const prev = globalThis.window;
    globalThis.window = {};
    let toastMsg = '';
    try {
      assert.equal(
        guardDocExportBlocked({
          isRpcOffline() {
            return true;
          },
          showToast(msg) {
            toastMsg = msg;
          },
        }),
        true
      );
      assert.match(toastMsg, /servidor local/);
      assert.equal(guardDocExportBlocked({ isRpcOffline() { return false; } }), false);
    } finally {
      globalThis.window = prev;
    }
  });
});

describe('parseContentDispositionFilename', () => {
  it('parses attachment filename', () => {
    assert.equal(
      parseContentDispositionFilename('attachment; filename="foo.docx"'),
      'foo.docx'
    );
  });

  it('returns null for missing header', () => {
    assert.equal(parseContentDispositionFilename(null), null);
  });
});
