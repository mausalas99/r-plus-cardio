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

test('normalizeFantasticosRows clears Furosemida misplaced in SGLT2i', () => {
  var rows = normalizeFantasticosRows([
    { className: 'SGLT2i', drug: 'Furosemida', inicio: '', dosis: '', tolerancia: '' },
    { className: 'Betabloqueador', drug: 'Bisoprolol', inicio: '', dosis: '', tolerancia: '' },
  ]);
  assert.equal(rows[1].className, 'SGLT2i');
  assert.equal(rows[1].drug, '');
  assert.equal(rows[2].drug, 'Bisoprolol');
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
      endedAt: '2026-03-18',
      dosis: '80 mg IV',
      indicacion: 'Descongestión',
      mgTotal: '640',
    }),
    {
      tipo: 'Furosemida',
      inicio: '2026-03-13',
      endedAt: '2026-03-18',
      dosis: '80 mg IV',
      indicacion: 'Descongestión',
      mgTotal: 640,
    }
  );
  assert.equal(serializeSegmentDraft({ tipo: 'x', mgTotal: '' }).mgTotal, null);
  assert.equal(serializeSegmentDraft({ tipo: 'x', endedAt: '  ' }).endedAt, null);
});

test('catalogTipoOptions merges catalog and current free text', () => {
  var opts = catalogTipoOptions(
    [{ tipo: 'Enoxaparina' }, { tipo: 'Furosemida' }],
    'Bumetanida'
  );
  assert.deepEqual(opts, ['Enoxaparina', 'Furosemida', 'Bumetanida']);
});

test('buildFantasticosTableHtml uses Spanish column labels', () => {
  var html = buildFantasticosTableHtml(emptyFantasticos(), [{ tipo: 'Furosemida' }]);
  assert.match(html, /Fantásticos/);
  assert.match(html, /Clase/);
  assert.match(html, /Fármaco/);
  assert.match(html, /Inicio/);
  assert.match(html, /Dosis/);
  assert.match(html, /Tolerancia/);
  assert.match(html, /data-manejo-fant=/);
  assert.match(html, /manejo-combo/);
  assert.doesNotMatch(html, /<datalist/);
  assert.match(html, /IECA\/ARA\/ARNI/);
  assert.match(html, /data-manejo-combo-opt="Dapagliflozina"/);
  assert.match(html, /data-manejo-combo-opt="Bisoprolol"/);
  assert.match(html, /data-manejo-combo-opt="Espironolactona"/);
  // General med catalog must not leak into Fantásticos suggestions.
  assert.doesNotMatch(html, /data-manejo-combo-opt="Furosemida"/);
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
  assert.match(medHtml, />Fin</);
  assert.match(medHtml, /Indicación/);
  assert.match(medHtml, /Agregar/);
  assert.match(medHtml, /rpc-date-input/);
  assert.match(medHtml, /data-manejo-seg-add="med"/);
  assert.match(medHtml, /manejo-combo/);
  assert.doesNotMatch(medHtml, /<datalist/);
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
  assert.match(diuHtml, /manejo-th-mg|>mg</);
  assert.match(diuHtml, />Fin</);
  assert.match(diuHtml, /data-manejo-seg-field="endedAt"/);
  assert.match(diuHtml, /data-manejo-seg-draft="endedAt"/);
  assert.match(diuHtml, /data-manejo-seg-end="d1"/);
  assert.match(diuHtml, /Cerrar/);
  assert.match(diuHtml, /data-manejo-seg-draft-repo="diuretic"/);
  assert.match(diuHtml, />Repo</);
  assert.match(diuHtml, /value="200"/);
  assert.match(diuHtml, /rpc-date-input/);
  assert.match(diuHtml, /Rangos inclusive/);
  assert.match(diuHtml, /manejo-td-tipo/);
  assert.match(diuHtml, /manejo-combo/);
  assert.match(diuHtml, /data-manejo-combo-opt="Furosemida"/);
  assert.doesNotMatch(diuHtml, /<datalist/);
});

test('cardioSegmentsNeedDemoHeal detects missing inicio/indicacion', async () => {
  const { cardioSegmentsNeedDemoHeal } = await import('./manejo-panel.mjs');
  assert.equal(
    cardioSegmentsNeedDemoHeal({
      medSegments: [{ tipo: 'Furosemida', inicio: '', dosis: '40 mg', indicacion: '' }],
    }),
    true
  );
  assert.equal(
    cardioSegmentsNeedDemoHeal({
      medSegments: [
        {
          tipo: 'Furosemida',
          inicio: '2026-03-17',
          dosis: '40 mg',
          indicacion: 'Descongestión',
        },
      ],
    }),
    false
  );
});

test('hydrateDemoIcPatientFromBundle fills inicio and indicacion', async () => {
  const {
    hydrateDemoIcPatientFromBundle,
    cardioSegmentsIncomplete,
    getBundledDemoIcPatient,
  } = await import('./demo-ic-hydrate.mjs');
  const bundled = getBundledDemoIcPatient();
  assert.ok(bundled && bundled.cardio);
  assert.equal(cardioSegmentsIncomplete(bundled.cardio), false);
  const stub = {
    registro: 'DEMO-IC-0001',
    nombre: 'Rosa María Delgado Vázquez',
    cardio: {
      medSegments: [{ id: 'm1', tipo: 'Furosemida', inicio: '', dosis: '40 mg', indicacion: '' }],
      diureticSegments: [],
      fantasticos: [],
    },
  };
  assert.equal(cardioSegmentsIncomplete(stub.cardio), true);
  assert.equal(hydrateDemoIcPatientFromBundle(stub), true);
  assert.equal(cardioSegmentsIncomplete(stub.cardio), false);
  assert.match(String(stub.cardio.medSegments[0].inicio), /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(String(stub.cardio.medSegments[0].indicacion).length > 0);
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
  assert.match(html, /manejo-combo/);
  assert.doesNotMatch(html, /<datalist/);
});
