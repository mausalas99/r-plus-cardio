import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveQrCanvasOpts } from './interno-qr-render.mjs';

test('resolveQrCanvasOpts targets ~2048px for print export', () => {
  const url = 'https://example.workers.dev/equipos?t=abc123';
  const { cellPx, margin } = resolveQrCanvasOpts(url);
  assert.ok(cellPx >= 8);
  assert.ok(margin >= cellPx * 4);
  const qrModules = 33;
  const edge = qrModules * cellPx + margin * 2;
  assert.ok(edge >= 1800, `expected print edge >= 1800px, got ${edge}`);
  assert.ok(edge <= 2400, `expected print edge <= 2400px, got ${edge}`);
});
