'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { releaseNotesPlainFromDoc } = require('./release-notes-plain.js');

const ROOT = path.join(__dirname, '../..');

describe('release-notes-plain', () => {
  it('extracts Nuevo/mejorado bullets from RELEASE_NOTES doc', () => {
    const plain = releaseNotesPlainFromDoc(ROOT, '7.1.7');
    assert.ok(plain.includes('Detección de cambio de red'));
    assert.ok(plain.includes('multi-subred') || plain.includes('subred'));
    assert.ok(!plain.includes('Signos vitales'));
  });

  it('includes Resumen plus bullets for 7.1.8 updater feed', () => {
    const plain = releaseNotesPlainFromDoc(ROOT, '7.1.8');
    assert.ok(plain.includes('Conectar al anfitrión') || plain.includes('Combinar servidores'));
    assert.ok(plain.includes('Cableado LAN transport'));
    assert.ok(!plain.includes('Signos vitales'));
  });
});
