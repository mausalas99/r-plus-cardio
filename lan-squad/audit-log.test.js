'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { appendAudit } = require('./audit-log.js');

describe('audit-log', () => {
  it('appends and caps at 500', () => {
    const log = [];
    for (let i = 0; i < 502; i++) {
      appendAudit({ at: 't', clientId: 'c', action: 'test', detail: { i } }, log);
    }
    assert.equal(log.length, 500);
    assert.equal(log[0].detail.i, 2);
    assert.equal(log[499].detail.i, 501);
  });
});
