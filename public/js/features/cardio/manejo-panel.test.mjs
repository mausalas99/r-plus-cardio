import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFantasticosRows,
  updateFantasticoField,
  buildSegmentRows,
  serializeSegmentDraft,
  catalogTipoOptions,
  buildFantasticosTableHtml,
  buildSegmentTableHtml,
  buildManejoPanelHtml,
} from './manejo-panel.mjs';
import { FANTASTICO_CLASSES, emptyFantasticos } from '../../../../lib/cardio/med-segments.mjs';

test('normalizeFantasticosRows always returns four class-aligned rows', () => {
  var rows = normalizeFantasticosRows([
    { className: 'SGLT2i', drug: 'Dapagliflozina', inicio: '2026-03-13', dosis: '10 mg', tolerancia: 'OK' },
  ]);
  assert.equal(rows.length, FANTASTICO_CLASSES.length);
  assert.equal(rows[0].className, 'IECA/ARA/ARNI');
  assert.equal(rows[0].drug, '');
  assert.equal(rows[1].className, 'SGLT2i');
  assert.equal(rows[1].drug, 'Dapagliflozina');
  assert.equal(rows[1].tolerancia, 'OK');
});

test('normalizeFantasticosRows fills empties from emptyFantasticos', () => {
  var rows = normalizeFantasticosRows(null);
  assert.deepEqual(
    rows.map(function (r) {
      return r.className;
    }),
    FANTASTICO_CLASSES
  );
  assert.deepEqual(rows, emptyFantasticos());
});

test('updateFantasticoField updates one field immutably', () => {
  var base = emptyFantasticos();
  var next = updateFantasticoField(base, 'Betabloqueador', 'drug', 'Carvedilol');
  assert.equal(base[2].drug, '');
  assert.equal(next[2].drug, 'Carvedilol');
  assert.equal(next[2].className, 'Betabloqueador');
});

test('buildSegmentRows maps active flag and fields', () => {
  var rows = buildSegmentRows([
    {
      id: 'a',
      tipo: 'Enoxaparina',
      inicio: '2026-03-13',
      dosis: '40 mg SC',
      indicacion: 'Profilaxis',
      endedAt: null,
      mgTotal: null,
    },
    {
      id: 'b',
      tipo: 'Furosemida',
      inicio: '2026-03-13',
      dosis: '80 mg',
      indicacion: 'Descongestión',
      endedAt: '2026-03-17',
      mgTotal: 640,
    },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].active, true);
  assert.equal(rows[1].active, false);
  assert.equal(rows[1].mgTotal, 640);
});

test('serializeSegmentDraft trims fields and coerces mgTotal', () => {
  assert.deepEqual(
    serializeSegmentDraft({
      tipo: '  Furosemida ',
      inicio: '2026-03-13',
      dosis: '80 mg IV',
      indicacion: 'Descongestión',
      mgTotal: '640',
    }),
    {
      tipo: 'Furosemida',
      inicio: '2026-03-13',
      dosis: '80 mg IV',
      indicacion: 'Descongestión',
      mgTotal: 640,
    }
  );
  assert.equal(serializeSegmentDraft({ tipo: 'x', mgTotal: '' }).mgTotal, null);
});

test('catalogTipoOptions merges catalog and current free text', () => {
  var opts = catalogTipoOptions(
    [{ tipo: 'Enoxaparina' }, { tipo: 'Furosemida' }],
    'Bumetanida'
  );
  assert.deepEqual(opts, ['Enoxaparina', 'Furosemida', 'Bumetanida']);
});

test('buildFantasticosTableHtml uses Spanish column labels', () => {
  var html = buildFantasticosTableHtml(emptyFantasticos(), []);
  assert.match(html, /Fantásticos/);
  assert.match(html, /Clase/);
  assert.match(html, /Fármaco/);
  assert.match(html, /Inicio/);
  assert.match(html, /Dosis/);
  assert.match(html, /Tolerancia/);
  assert.match(html, /data-manejo-fant=/);
  assert.match(html, /IECA\/ARA\/ARNI/);
});

test('buildSegmentTableHtml includes actions and optional mgTotal', () => {
  var medHtml = buildSegmentTableHtml({
    title: 'Otros medicamentos',
    kind: 'med',
    segments: [],
    catalog: [{ tipo: 'Enoxaparina' }],
  });
  assert.match(medHtml, /Otros medicamentos/);
  assert.match(medHtml, /Tipo/);
  assert.match(medHtml, /Indicación/);
  assert.match(medHtml, /Agregar/);
  assert.match(medHtml, /data-manejo-seg-add="med"/);
  assert.doesNotMatch(medHtml, /mg total/i);

  var diuHtml = buildSegmentTableHtml({
    title: 'Diuréticos',
    kind: 'diuretic',
    segments: [
      {
        id: 'd1',
        tipo: 'Furosemida',
        inicio: '2026-03-13',
        dosis: '80 mg',
        indicacion: 'Descongestión',
        endedAt: null,
        mgTotal: 200,
      },
    ],
    catalog: [],
  });
  assert.match(diuHtml, /Diuréticos/);
  assert.match(diuHtml, /mg total/i);
  assert.match(diuHtml, /data-manejo-seg-end="d1"/);
  assert.match(diuHtml, /Guardar tipo en repo/);
  assert.match(diuHtml, /value="200"/);
});

test('buildManejoPanelHtml wires three sections from cardio', () => {
  var html = buildManejoPanelHtml({
    fantasticos: emptyFantasticos(),
    medSegments: [],
    diureticSegments: [],
    medCatalog: [{ tipo: 'Furosemida' }],
  });
  assert.match(html, /data-manejo-panel="1"/);
  assert.match(html, /Fantásticos/);
  assert.match(html, /Otros medicamentos/);
  assert.match(html, /Diuréticos/);
  assert.match(html, /manejo-catalog-tipos/);
});
