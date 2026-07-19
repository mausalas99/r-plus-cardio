'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const docExport = require('./doc-export-service.js');

describe('exportIcHojaDocx', () => {
  it('builds a named docx buffer from patient + asOfDate', async () => {
    const { buffer, fileName } = await docExport.exportIcHojaDocx({
      patient: { nombre: 'Test IC', registro: '1-1', edad: '50' },
      asOfDate: '2026-03-19',
    });
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 1000);
    assert.match(fileName, /^Hoja_IC_Test_IC_2026_03_19\.docx$/);
  });
});
