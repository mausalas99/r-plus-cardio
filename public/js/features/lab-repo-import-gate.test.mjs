import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  shouldSilentImportLabRepo,
  buildLabRepoBulkText,
  buildLabRepoPreviewBlocks,
  resolveLabRepoFetchUserMessage,
} = await import('./lab-repo-import-gate.mjs');

function okBlock(overrides) {
  return Object.assign(
    { status: 'ok', canProcess: true, okReportCount: 1 },
    overrides || {}
  );
}

test('shouldSilentImportLabRepo false when fetch errors present', () => {
  var d = shouldSilentImportLabRepo({
    blocks: [okBlock()],
    fetchErrors: [{ folio: '1', message: 'x' }],
    requestedRegistro: '2203912-1',
    activePatientRegistro: '2203912-1',
    activePatientId: 'p1',
  });
  assert.equal(d.silent, false);
  assert.equal(d.reason, 'fetch-errors');
});

test('shouldSilentImportLabRepo false when no blocks', () => {
  var d = shouldSilentImportLabRepo({
    blocks: [],
    fetchErrors: [],
    requestedRegistro: '2203912-1',
    activePatientRegistro: '2203912-1',
    activePatientId: 'p1',
  });
  assert.equal(d.silent, false);
  assert.equal(d.reason, 'no-blocks');
});

test('shouldSilentImportLabRepo false when block status issues', () => {
  var cases = [
    okBlock({ status: 'no-patient' }),
    okBlock({ canProcess: false }),
    okBlock({ okReportCount: 0 }),
  ];
  cases.forEach(function (block) {
    var d = shouldSilentImportLabRepo({
      blocks: [block],
      fetchErrors: [],
      requestedRegistro: '2203912-1',
      activePatientRegistro: '2203912-1',
      activePatientId: 'p1',
    });
    assert.equal(d.silent, false, 'expected review for ' + JSON.stringify(block));
    assert.equal(d.reason, 'block-issues');
  });
});

test('shouldSilentImportLabRepo false when registro mismatch with active patient', () => {
  var d = shouldSilentImportLabRepo({
    blocks: [okBlock()],
    fetchErrors: [],
    requestedRegistro: '2203912-1',
    activePatientRegistro: '9999999-9',
    activePatientId: 'p1',
  });
  assert.equal(d.silent, false);
  assert.equal(d.reason, 'registro-mismatch');
});

test('shouldSilentImportLabRepo true when all checks pass', () => {
  var d = shouldSilentImportLabRepo({
    blocks: [okBlock(), okBlock({ okReportCount: 2 })],
    fetchErrors: [],
    requestedRegistro: '2203912-1',
    activePatientRegistro: '2203912-1',
    activePatientId: 'p1',
  });
  assert.equal(d.silent, true);
  assert.equal(d.reason, 'ok');
});

test('shouldSilentImportLabRepo ignores registro mismatch without active patient', () => {
  var d = shouldSilentImportLabRepo({
    blocks: [okBlock()],
    fetchErrors: [],
    requestedRegistro: '2203912-1',
    activePatientRegistro: '9999999-9',
    activePatientId: null,
  });
  assert.equal(d.silent, true);
  assert.equal(d.reason, 'ok');
});

test('buildLabRepoBulkText joins reports for one patient block', () => {
  var text = buildLabRepoBulkText([
    { text: 'Expediente: 1\nNombre: A' },
    { text: 'Expediente: 1\nNombre: A\nBH' },
  ]);
  assert.match(text, /Expediente: 1/);
  assert.match(text, /\n\n/);
  assert.match(text, /BH/);
});

test('buildLabRepoBulkText skips empty study text', () => {
  var text = buildLabRepoBulkText([
    { text: 'Expediente: 1\nNombre: A' },
    { text: '   ' },
    { text: 'Expediente: 1\nNombre: A\nQS' },
  ]);
  assert.equal(text.split('\n\n').length, 2);
});

test('buildLabRepoPreviewBlocks delegates to buildBulkLabPreview', async () => {
  var store = {};
  var mockStorage = {
    getItem: function (k) {
      return k in store ? store[k] : null;
    },
    setItem: function (k, v) {
      store[k] = String(v);
    },
    removeItem: function (k) {
      delete store[k];
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  globalThis.window = { localStorage: mockStorage };

  var { DEMO_SOME_LAB_REPORT } = await import('../tour-demo-some-lab.mjs');
  var blocks = buildLabRepoPreviewBlocks(
    [{ text: DEMO_SOME_LAB_REPORT }],
    function (reg) {
      if (reg === '0008421-7') return { id: 'p1', nombre: 'Demo', registro: '0008421-7' };
      return null;
    }
  );
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].status, 'ok');
  assert.ok(blocks[0].okReportCount >= 1);
  assert.equal(blocks[0].patient.id, 'p1');
});

test('resolveLabRepoFetchUserMessage maps no-search-results without connection error', () => {
  var msg = resolveLabRepoFetchUserMessage([], [{ folio: '', message: 'no-search-results' }]);
  assert.ok(msg);
  assert.match(msg.toast, /No hay estudios para ese registro/);
  assert.equal(msg.type, 'info');
});

test('resolveLabRepoFetchUserMessage maps no-rows-in-range with totalRows hint', () => {
  var msg = resolveLabRepoFetchUserMessage([], [{
    folio: '',
    message: 'no-rows-in-range',
    totalRows: 5,
  }]);
  assert.ok(msg);
  assert.match(msg.toast, /5 estudio/);
  assert.match(msg.toast, /rango de fechas/);
});

test('resolveLabRepoFetchUserMessage maps HTTP errors to connection toast', () => {
  var msg = resolveLabRepoFetchUserMessage([], [{ folio: '', message: 'lab-repo-http-503' }]);
  assert.ok(msg);
  assert.match(msg.toast, /No se pudo conectar/);
  assert.equal(msg.type, 'error');
});
