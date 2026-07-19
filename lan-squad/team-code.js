'use strict';
const crypto = require('node:crypto');

const PREFIX = 'lan-squad-v1';

function hashTeamCode(plain) {
  return crypto.createHash('sha256').update(PREFIX + String(plain || ''), 'utf8').digest('hex');
}

function verifyTeamCode(plain, storedHash) {
  const a = hashTeamCode(plain);
  const b = String(storedHash || '');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

module.exports = { hashTeamCode, verifyTeamCode };
