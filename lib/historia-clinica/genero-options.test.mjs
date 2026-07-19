import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generoSexBucket,
  defaultGeneroBlock,
  normalizeGeneroBlock,
  formatGeneroSection,
  formatGeneroFieldLine,
  generoFieldHasContent,
} from './genero-options.mjs';

test('generoSexBucket maps M vs default female', () => {
  assert.equal(generoSexBucket('M'), 'male');
  assert.equal(generoSexBucket('F'), 'female');
});

test('defaultGeneroBlock seeds structured negado fields', () => {
  const block = defaultGeneroBlock('F');
  assert.deepEqual(block.menarca, {});
  assert.deepEqual(block.gpac, {});
});

test('normalizeGeneroBlock migrates string age', () => {
  const block = normalizeGeneroBlock({ menarca: '12 años' }, 'F');
  assert.equal(block.menarca.edad, '12');
});

test('normalizeGeneroBlock migrates GPAC string', () => {
  const block = normalizeGeneroBlock({ gpac: 'G2P1A0C1' }, 'F');
  assert.equal(block.gpac.g, '2');
  assert.equal(block.gpac.c, '1');
});

test('formatGeneroFieldLine formats GPAC counts', () => {
  const block = normalizeGeneroBlock({ gpac: { g: '2', p: '1', a: '0', c: '0' } }, 'F');
  const line = formatGeneroFieldLine({ id: 'gpac', label: 'Gestas, partos, abortos y cesáreas', kind: 'gpac' }, block.gpac);
  assert.match(line, /G2 P1 A0 C0/);
});

test('formatGeneroSection collapses all-negado', () => {
  const text = formatGeneroSection(defaultGeneroBlock('F'), 'F');
  assert.match(text, /Menarca/);
  assert.match(text, /interrogado y negado/);
});

test('formatGeneroSection lists documented fields only', () => {
  const block = defaultGeneroBlock('F');
  block.menopausia = { detalle: 'A los 48 años.' };
  assert.ok(generoFieldHasContent({ id: 'menopausia', kind: 'detail' }, block.menopausia));
  const text = formatGeneroSection(block, 'F');
  assert.match(text, /Menopausia: A los 48/);
  assert.doesNotMatch(text, /Menarca:/);
});
