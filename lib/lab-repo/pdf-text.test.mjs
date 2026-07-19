import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractSomeTextFromPdfBuffer,
  looksLikeExtractedSome,
  normalizePdfExtract,
} from './pdf-text.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const pdfPath = path.join(__dir, 'fixtures', 'sample-some.pdf');

test('looksLikeExtractedSome requires Expediente and Nombre headers', () => {
  assert.equal(
    looksLikeExtractedSome('Expediente: 123\nNombre: PACIENTE'),
    true
  );
  assert.equal(looksLikeExtractedSome('Expediente: 123'), false);
  assert.equal(looksLikeExtractedSome('Nombre: PACIENTE'), false);
  assert.equal(looksLikeExtractedSome(''), false);
});

test('normalizePdfExtract collapses line noise', () => {
  const raw = 'Expediente: 1  \r\n\r\n\r\nNombre: X  \n\n\nHEMATOLOGÍA';
  assert.equal(
    normalizePdfExtract(raw),
    'Expediente: 1\n\nNombre: X\n\nHEMATOLOGÍA'
  );
});

test('extractSomeTextFromPdfBuffer returns Expediente header', async () => {
  if (!fs.existsSync(pdfPath)) {
    return;
  }
  const buf = fs.readFileSync(pdfPath);
  const text = await extractSomeTextFromPdfBuffer(buf);
  assert.ok(looksLikeExtractedSome(text));
  assert.match(text, /Expediente\s*:/i);
});
