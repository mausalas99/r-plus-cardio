'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { hashTeamCode, verifyTeamCode } = require('./team-code.js');

describe('team-code', () => {
  it('verifyTeamCode acepta el mismo código', () => {
    const stored = hashTeamCode('mi-equipo-2026');
    assert.strictEqual(verifyTeamCode('mi-equipo-2026', stored), true);
    assert.strictEqual(verifyTeamCode('otro', stored), false);
  });
});
