const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderCensusPdf } = require('./generate-censo.js');

test('renderCensusPdf devuelve buffer PDF con fichas', async () => {
  var buf = await renderCensusPdf({
    header: {
      mes: 'MAYO 2026',
      fecha: '29/05/2026',
      profesor: 'Dr. X',
      r2: 'R2 Name',
      r1: '',
      servicio: 'MEDICINA INTERNA',
      doctor: '',
    },
    rows: [
      {
        num: '1',
        cama: '201',
        pacienteNombre: 'PACIENTE PRUEBA',
        pacienteMeta: '123\n54 años',
        dx: 'DM2 + ERC estadio 5',
        meds: 'FENITOINA 100 mg IV c/8h',
        labs: '29/05/2026 — BH Hb 5.8* Hto 18* · QS Glu 145 Cr 1.2',
        accesos: 'CVC',
        cultivos: '07/05/2026\nUROCULTIVO: E. COLI\nATB S: CIPRO',
        pendientes: 'Transfusión HB',
      },
      {
        num: '2',
        cama: '211-1',
        pacienteNombre: 'OTRO PACIENTE',
        dx: 'Neumonía',
        meds: '—',
        labs: '—',
        pendientes: 'IC cardio',
      },
    ],
  });
  assert.ok(buf instanceof Uint8Array);
  assert.equal(String.fromCharCode(buf[0], buf[1], buf[2], buf[3]), '%PDF');
  assert.ok(buf.length > 500);
});
