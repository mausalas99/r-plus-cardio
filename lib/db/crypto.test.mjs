import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveSqlcipherKeyHex,
  deriveRecoveryWrappingKeyHex,
  generateRecoveryCode,
  normalizeRecoveryCodeInput,
  wrapDek,
  unwrapDek,
  wrapKeyForRecovery,
  unwrapKeyForRecovery,
  LEGACY_RECOVERY_CODE,
} from './crypto.mjs';

const mockSafe = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from('enc:' + s).toString('base64'),
  decryptString: (s) => Buffer.from(s, 'base64').toString('utf8').replace(/^enc:/, ''),
};

describe('crypto', () => {
  it('deriveSqlcipherKeyHex is 64 hex chars', async () => {
    const salt = Buffer.alloc(16, 1);
    const hex = await deriveSqlcipherKeyHex('test-pass', salt);
    assert.match(hex, /^[0-9a-f]{64}$/);
  });

  it('wrap and unwrap DEK', () => {
    const dek = 'ab'.repeat(32);
    const wrapped = wrapDek(dek, mockSafe);
    assert.equal(unwrapDek(wrapped, mockSafe), dek);
  });

  it('generateRecoveryCode uses R+ prefix', () => {
    const code = generateRecoveryCode();
    assert.match(code, /^R\+[A-Z2-9]{8}$/);
  });

  it('normalizeRecoveryCodeInput trims and uppercases', () => {
    assert.equal(normalizeRecoveryCodeInput(' r+abc12 '), 'R+ABC12');
  });

  it('per-install recovery wrap roundtrip', async () => {
    const salt = Buffer.alloc(16, 2);
    const code = generateRecoveryCode();
    const wrapKey = await deriveRecoveryWrappingKeyHex(salt, code);
    const dekHex = 'cd'.repeat(32);
    const wrapped = wrapKeyForRecovery(dekHex, wrapKey);
    const unwrapped = unwrapKeyForRecovery(wrapped, wrapKey);
    assert.equal(unwrapped, dekHex);
  });

  it('legacy recovery code still derives distinct wrapping key', async () => {
    const salt = Buffer.alloc(16, 3);
    const modern = await deriveRecoveryWrappingKeyHex(salt, generateRecoveryCode());
    const legacy = await deriveRecoveryWrappingKeyHex(salt, LEGACY_RECOVERY_CODE);
    assert.notEqual(modern, legacy);
  });
});
