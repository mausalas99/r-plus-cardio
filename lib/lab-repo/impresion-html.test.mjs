import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractSomeTextFromImpresionHtml,
  impresionUrlFromSelectHtml,
} from './impresion-html.mjs';
import { looksLikeExtractedSome } from './pdf-text.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const FIX = (name) => fs.readFileSync(path.join(__dir, 'fixtures', name), 'utf8');

test('impresionUrlFromSelectHtml parses window.open target', () => {
  const html =
    "<script>window.open('Impresion.aspx','_blank','width=700')</script>";
  assert.equal(impresionUrlFromSelectHtml(html), 'Impresion.aspx');
});

test('extractSomeTextFromImpresionHtml yields SOME headers', () => {
  const text = extractSomeTextFromImpresionHtml(FIX('live-impresion.html'));
  assert.ok(looksLikeExtractedSome(text));
  assert.match(text, /Expediente:\s*1862133-7/i);
  assert.match(text, /Nombre:\s*JUAN GABRIEL CASTILLO SALAZAR/i);
  assert.match(text, /GASOMETRIA/i);
  assert.match(text, /PH/i);
});
