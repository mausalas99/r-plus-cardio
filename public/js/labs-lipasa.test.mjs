import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLipasa_, procesarLabs } from './labs.js';

const LIPASA_ONLY = `Expediente:\t2224377-6\tSolicitud:\t2606120928
Nombre:\tCESAR ALEXIS ARAMBULA SALAZAR\tFecha Registro:\tJun 12 2026 4:29PM
Sexo:\tMASCULINO\tUbicación:\tEMERGENCIAS SHOCK TRAUMA SALA
Edad:\t23\tMedico:\tA QUIEN CORRESPONDA
 

QUIMICA CLINICA
LIPASA
Estudio\t\tResultado\tUnidades\tValor de Referencia
LIPASA SERICA\t
A
1244
U/L\t8 - 57`;

test('parseLipasa_ extrae lipasa elevada con flag A', () => {
  const tNorm = LIPASA_ONLY.replace(/\s+/g, ' ');
  const out = parseLipasa_(tNorm);
  assert.match(out, /^LIPASA\tLip 1244\*$/);
});

test('procesarLabs reporte solo lipasa produce sección LIPASA', () => {
  const r = procesarLabs(LIPASA_ONLY);
  assert.equal(r.resLabs.length, 1);
  assert.match(r.resLabs[0], /^LIPASA\tLip 1244\*$/);
});

test('parseLipasa_ devuelve vacío sin lipasa', () => {
  assert.equal(parseLipasa_('GLUCOSA EN SANGRE 95 mg/dL'), '');
});
