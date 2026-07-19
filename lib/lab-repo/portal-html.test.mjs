import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseAspNetHiddenFields,
  parseLabResultRows,
  parseFechaSolicitudMs,
  filterRowsByDateRange,
  parseSearchFormControls,
  isRegistroSearchMode,
  pageIndicatesNoSearchResults,
} from './portal-html.mjs';
import {
  LAB_REPO_SEARCH_MODE_NOMBRE,
  LAB_REPO_SEARCH_MODE_REGISTRO,
} from './constants.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const FIX = (name) => fs.readFileSync(path.join(__dir, 'fixtures', name), 'utf8');

test('parseAspNetHiddenFields extracts ViewState trio', () => {
  const html = FIX('index-initial.html');
  const hidden = parseAspNetHiddenFields(html);
  assert.ok(hidden.__VIEWSTATE);
  assert.ok(hidden.__EVENTVALIDATION);
  assert.equal(hidden.__VIEWSTATEGENERATOR, '');
});

test('parseSearchFormControls reads Drop1, TextBox2, Button1 from initial page', () => {
  const controls = parseSearchFormControls(FIX('index-initial.html'));
  assert.equal(controls.modeFieldName, 'Drop1');
  assert.equal(controls.searchFieldName, 'TextBox2');
  assert.equal(controls.searchButtonName, 'Button1');
  assert.equal(controls.currentMode, LAB_REPO_SEARCH_MODE_NOMBRE);
  assert.equal(isRegistroSearchMode(controls), false);
});

test('parseSearchFormControls detects REGISTRO mode on results page', () => {
  const controls = parseSearchFormControls(FIX('search-results-registro.html'));
  assert.equal(controls.currentMode, LAB_REPO_SEARCH_MODE_REGISTRO);
  assert.equal(isRegistroSearchMode(controls), true);
});

test('parseLabResultRows reads Fecha Solicitud, Folio, Seleccionar target', () => {
  const html = FIX('search-results-registro.html');
  const rows = parseLabResultRows(html);
  assert.equal(rows.length, 3);
  assert.match(rows[0].fechaSolicitud, /^\d{4}-\d{2}-\d{2}/);
  assert.equal(rows[0].folio, '2606270295');
  assert.equal(rows[0].selectEventTarget, 'GridView1');
  assert.equal(rows[0].selectEventArgument, 'Select$0');
  assert.equal(rows[0].registro, '2203912-1');
  assert.equal(rows[0].nombre, 'PACIENTE FIXTURE');
  assert.equal(rows[0].departamento, 'GASOMETRIAS 5TO PISO');
  assert.equal(rows[0].tipo, 'GASOMETRIA VENOSA PARCIAL');
  assert.equal(rows[2].selectEventArgument, 'Select$2');
  assert.equal(rows[2].folio, '2606260100');
});

test('parseFechaSolicitudMs parses portal datetime', () => {
  const ms = parseFechaSolicitudMs('2026-06-27 03:35');
  const date = new Date(ms);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 5);
  assert.equal(date.getDate(), 27);
  assert.equal(date.getHours(), 3);
  assert.equal(date.getMinutes(), 35);
  assert.equal(parseFechaSolicitudMs('invalid'), NaN);
});

test('filterRowsByDateRange keeps rows inside inclusive window', () => {
  const rows = [
    { fechaSolicitud: '2026-06-27 03:35', folio: '1' },
    { fechaSolicitud: '2026-06-26 08:00', folio: '2' },
  ];
  const desde = new Date('2026-06-27T00:00:00');
  const hasta = new Date('2026-06-27T23:59:59');
  const out = filterRowsByDateRange(rows, desde, hasta);
  assert.equal(out.length, 1);
  assert.equal(out[0].folio, '1');
});

test('filterRowsByDateRange filters fixture rows by Fecha Solicitud', () => {
  const rows = parseLabResultRows(FIX('search-results-registro.html'));
  const desde = new Date('2026-06-27T00:00:00');
  const hasta = new Date('2026-06-27T23:59:59');
  const out = filterRowsByDateRange(rows, desde, hasta);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((row) => row.folio), ['2606270295', '2606270175']);
});

test('pageIndicatesNoSearchResults detects portal empty search label', () => {
  assert.equal(pageIndicatesNoSearchResults('<<< SIN COINCIDENCIAS >>>'), true);
  assert.equal(pageIndicatesNoSearchResults(FIX('search-results-registro.html')), false);
});
