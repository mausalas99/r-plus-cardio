import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, formatSpeed, formatProgressLine } from './update-helpers.mjs';

test('formatBytes redondea MB legibles', () => {
  assert.match(formatBytes(39258624), /37\.\d+ MB/);
  assert.match(formatBytes(62075776), /59\.\d+ MB/);
});

test('formatSpeed devuelve — sin tasa', () => {
  assert.equal(formatSpeed(0), '—');
  assert.equal(formatSpeed(-1), '—');
});

test('formatProgressLine concatena partes', () => {
  const s = formatProgressLine({
    transferred: 10 * 1024 * 1024,
    total: 20 * 1024 * 1024,
    bytesPerSecond: 1024 * 1024,
  });
  assert.ok(s.includes('Descargando'));
  assert.ok(s.includes('/'));
});
