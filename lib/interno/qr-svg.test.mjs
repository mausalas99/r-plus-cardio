import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderQrSvg } from './qr-svg.mjs';

test('renderQrSvg returns svg with modules', () => {
  const svg = renderQrSvg('http://192.168.1.5:3738/interno/sala-1?t=abc');
  assert.match(svg, /^<svg/);
  assert.match(svg, /<rect[^>]+fill="#000"/);
});
