import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIcExportPayload } from '../cardio/ic-export-payload.mjs';
import { sumFurosemidaMg } from '../cardio/med-segments.mjs';

const require = createRequire(import.meta.url);
const { generateIcHojaBuffer } = require('./ic-hoja.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = path.join(root, 'data/demo-patients/ma-elena-ic-fixture.json');

describe('Ma.Elena IC fixture smoke', () => {
  it('builds payload from fixture and generates a non-empty docx buffer', async () => {
    const exportJson = JSON.parse(readFileSync(fixturePath, 'utf8'));
    assert.equal(exportJson.format, 'r-plus-patient-export');
    const patient = exportJson.patient;
    assert.ok(patient && typeof patient === 'object');

    const diureticSegments = patient.cardio?.diureticSegments || [];
    assert.equal(sumFurosemidaMg(diureticSegments), 800);
    assert.ok(Array.isArray(patient.cardio?.pocusByDay) && patient.cardio.pocusByDay.length >= 2);
    assert.ok(patient.eventualidades?.entries?.length >= 2);

    const payload = buildIcExportPayload(patient, { asOfDate: '2026-03-19' });
    assert.equal(payload.nombre, 'Ma. Elena Contreras Alvarado');
    assert.equal(payload.registro, '0893295-0');
    assert.equal(payload.vexus, 0);
    assert.equal(payload.congestionScore, 0);
    assert.ok(payload.eventosLines.length >= 2);
    assert.ok(payload.pocusLines.length >= 2);

    const buf = await generateIcHojaBuffer({ payload });
    assert.ok(Buffer.isBuffer(buf));
    assert.ok(buf.length > 1000);
  });
});
