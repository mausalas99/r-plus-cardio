import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isRPlusPatientExportPayload,
  resolvePatientImportPayloads,
  describePatientImportRejection,
  parsePatientImportJsonText,
  stripJsonBom,
} from './patient-export-format.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('demo-perez.json pasa validación de importación', () => {
  const text = fs.readFileSync(path.join(root, 'docs/demo-patients/demo-perez.json'), 'utf8');
  const { payloads } = parsePatientImportJsonText(text);
  assert.equal(payloads.length, 1);
  assert.equal(isRPlusPatientExportPayload(payloads[0]), true);
});

test('demo-pitch-rango.json se importa como paciente(s) vía entries', () => {
  const text = fs.readFileSync(path.join(root, 'docs/demo-patients/demo-pitch-rango.json'), 'utf8');
  const { payloads } = parsePatientImportJsonText(text);
  assert.equal(payloads.length, 1);
});

test('stripJsonBom y bundle', () => {
  const raw = JSON.parse(
    stripJsonBom('\ufeff' + fs.readFileSync(path.join(root, 'docs/demo-patients/demo-pitch-bundle.json'), 'utf8'))
  );
  assert.equal(resolvePatientImportPayloads(raw).length, 1);
});

test('describePatientImportRejection para respaldo completo', () => {
  const msg = describePatientImportRejection({ format: 'r-plus-backup', version: 1 });
  assert.match(msg, /copia de seguridad/i);
});
