import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  censoFileName,
  censoDateStamp,
  listCensoFilesForDate,
  writeCensoPdf,
} from './censo-export-file.mjs';

test('censoFileName — servicio, fecha y hora únicas por exportación', () => {
  var d = new Date(2026, 5, 3, 15, 30, 45);
  assert.equal(censoFileName('ONCO', d), 'Censo_ONCO_2026-06-03_15-30-45.pdf');
  assert.equal(censoDateStamp(d), '2026-06-03');
});

test('writeCensoPdf — conserva otros censos del mismo día', () => {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'censo-export-'));
  var d = new Date(2026, 5, 3, 10, 0, 0);
  try {
    var other1 = 'Censo_GUARDIA_2026-06-03_08-00-00.pdf';
    var other2 = 'Censo_TORRE_2026-06-03_09-15-30.pdf';
    fs.writeFileSync(path.join(dir, other1), Buffer.from('old'));
    fs.writeFileSync(path.join(dir, other2), Buffer.from('old2'));
    fs.writeFileSync(path.join(dir, 'Censo_GUARDIA_2026-06-02.pdf'), Buffer.from('yesterday'));
    fs.writeFileSync(path.join(dir, 'Nota_Evolucion_X.docx'), Buffer.from('other'));

    var newName = censoFileName('ONCO', d);
    writeCensoPdf(dir, newName, Buffer.from('new'));

    assert.equal(fs.readFileSync(path.join(dir, newName), 'utf8'), 'new');
    assert.equal(fs.existsSync(path.join(dir, other1)), true);
    assert.equal(fs.existsSync(path.join(dir, other2)), true);
    assert.equal(fs.existsSync(path.join(dir, 'Censo_GUARDIA_2026-06-02.pdf')), true);
    assert.equal(listCensoFilesForDate(dir, '2026-06-03').length, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
