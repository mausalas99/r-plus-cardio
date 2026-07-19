import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { hashRaw } from '@node-rs/argon2';

export const ARGON2_OPTS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
};

/** @deprecated Universal fallback for databases wrapped before recovery v2. */
export const LEGACY_RECOVERY_CODE = 'r+123';
const AES_ALGO = 'aes-256-gcm';
const RECOVERY_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newSalt() {
  return randomBytes(16);
}

/** @param {string} passphrase @param {Buffer} saltBuf */
export async function deriveSqlcipherKeyHex(passphrase, saltBuf) {
  const dk = await hashRaw(passphrase, { salt: saltBuf, ...ARGON2_OPTS });
  return Buffer.from(dk).toString('hex');
}

/** @param {string} code */
export function normalizeRecoveryCodeInput(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/** Generates a per-installation recovery code (shown once to the user). */
export function generateRecoveryCode() {
  let out = 'R+';
  const bytes = randomBytes(10);
  for (let i = 0; i < 8; i += 1) {
    out += RECOVERY_CODE_CHARS[bytes[i] % RECOVERY_CODE_CHARS.length];
  }
  return out;
}

/** @param {Buffer} saltBuf @param {string} recoveryCode */
export async function deriveRecoveryWrappingKeyHex(saltBuf, recoveryCode) {
  const normalized = normalizeRecoveryCodeInput(recoveryCode);
  const dk = await hashRaw(normalized, { salt: saltBuf, ...ARGON2_OPTS });
  return Buffer.from(dk).toString('hex');
}

/**
 * @param {string} keyHex SQLCipher key as hex string
 * @param {string} wrappingKeyHex 32-byte key as hex string
 * @returns {{ iv: string, tag: string, data: string }}
 */
export function wrapKeyForRecovery(keyHex, wrappingKeyHex) {
  const key = Buffer.from(wrappingKeyHex, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv(AES_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(keyHex, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

/**
 * @param {{ iv: string, tag: string, data: string }} wrapped
 * @param {string} wrappingKeyHex 32-byte key as hex string
 * @returns {string} SQLCipher key hex
 */
export function unwrapKeyForRecovery(wrapped, wrappingKeyHex) {
  const key = Buffer.from(wrappingKeyHex, 'hex');
  const iv = Buffer.from(wrapped.iv, 'base64');
  const tag = Buffer.from(wrapped.tag, 'base64');
  const data = Buffer.from(wrapped.data, 'base64');
  const decipher = createDecipheriv(AES_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

/** @param {string} dekHex @param {{ isEncryptionAvailable: () => boolean, encryptString: (s: string) => string }} safeStorage */
export function wrapDek(dekHex, safeStorage) {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = safeStorage.encryptString(dekHex);
    if (encrypted == null) return null;
    if (Buffer.isBuffer(encrypted)) return encrypted.toString('base64');
    return String(encrypted);
  } catch {
    return null;
  }
}

/** @param {string | null | undefined} wrapped @param {{ isEncryptionAvailable: () => boolean, decryptString: (s: string | Buffer) => string }} safeStorage */
export function unwrapDek(wrapped, safeStorage) {
  if (!wrapped || !safeStorage.isEncryptionAvailable()) return null;
  try {
    let encrypted = wrapped;
    if (typeof wrapped === 'string' && !wrapped.startsWith('enc:')) {
      try {
        encrypted = Buffer.from(wrapped, 'base64');
      } catch {
        encrypted = wrapped;
      }
    }
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}
