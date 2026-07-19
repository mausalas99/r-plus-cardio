/**
 * Magic-byte checks for packaged .node binaries (release gate).
 */
import fs from 'node:fs';

/** @param {string} abs */
export function readBinaryHeader(abs) {
  const buf = Buffer.alloc(4);
  const fh = fs.openSync(abs, 'r');
  try {
    fs.readSync(fh, buf, 0, 4, 0);
  } finally {
    fs.closeSync(fh);
  }
  return buf;
}

/** @param {Buffer} buf */
export function isWindowsPe(buf) {
  return buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a;
}

/** @param {Buffer} buf */
export function isMachO(buf) {
  if (buf.length < 4) return false;
  const le = buf.readUInt32LE(0);
  const be = buf.readUInt32BE(0);
  return (
    le === 0xfeedface ||
    le === 0xfeedfacf ||
    be === 0xfeedface ||
    be === 0xfeedfacf ||
    le === 0xcafebabe ||
    be === 0xcafebabe
  );
}

/**
 * @param {string} abs
 * @param {'darwin'|'win32'|'linux'} expectedPlatform
 */
export function describeNativeBinary(abs, expectedPlatform) {
  if (!fs.existsSync(abs)) {
    return { ok: false, reason: 'missing', format: 'missing' };
  }
  const buf = readBinaryHeader(abs);
  if (isWindowsPe(buf)) {
    return {
      ok: expectedPlatform === 'win32',
      reason: expectedPlatform === 'win32' ? 'ok' : 'windows_pe_on_non_windows',
      format: 'pe',
    };
  }
  if (isMachO(buf)) {
    return {
      ok: expectedPlatform === 'darwin',
      reason: expectedPlatform === 'darwin' ? 'ok' : 'mach_o_on_non_darwin',
      format: 'mach-o',
    };
  }
  return { ok: false, reason: 'unknown_format', format: 'unknown' };
}
