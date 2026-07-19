import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function stubDocument() {
  return {
    documentElement: { classList: { toggle() {} } },
    body: { classList: { toggle() {}, remove() {} } },
    addEventListener() {},
    getElementById() {
      return null;
    },
  };
}

describe('app-shell-modals', () => {
  it('imports without touching the DOM', async () => {
    const mod = await import('./app-shell-modals.mjs');
    assert.equal(typeof mod.initModalDismiss, 'function');
  });

  it('initModalDismiss is idempotent with a stubbed document', async () => {
    const priorDoc = globalThis.document;
    globalThis.document = stubDocument();
    try {
      const mod = await import('./app-shell-modals.mjs');
      mod.initModalDismiss();
      mod.initModalDismiss();
    } finally {
      globalThis.document = priorDoc;
    }
  });
});
