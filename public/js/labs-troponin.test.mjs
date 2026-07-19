import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTroponina_,
  troponinaDeltaPct_,
  mergeTroponinaResLabRows_,
  buildTroponinaResLabLine_,
} from './labs-troponin.mjs';
import { procesarLabs, looksLikeSomeLabReport } from './labs.js';
import { dedupeConsolidatedLabRows } from './lab-bulk-paste.mjs';
import { buildParsedBySectionFromResLabs } from './features/diagrams-parse.mjs';

const MUESTRA_TROPONINA = `
Expediente:	2230539-8	Solicitud:	199140
Nombre:	DAVID ALEJANDRO MARTINEZ ALCALA	Fecha Registro:	Jul 7 2026 1:24PM
Sexo:	MASCULINO	Ubicación:	URGENCIAS ADULTOS
Edad:	20	Medico:	A QUIEN CORRESPONDA
 

BANCO DE SANGRE


HsTnl o Troponina I (Alta

Estudio	Resultado	Unidades	Valor de Referencia

HsTnl o Troponina I (Alta Sensibilidad)	

2180.300
INDETERMINADO

ng/L	
Positivo >= 0.00S/CO
Negativo <= 0.00S/CO
`;

const MUESTRA_TROPONINA_BAJA = `
Expediente:	2230539-8
Nombre:	DAVID ALEJANDRO MARTINEZ ALCALA	Fecha Registro:	Jul 7 2026 10:24AM
BANCO DE SANGRE
HsTnl o Troponina I (Alta Sensibilidad)	
12.5
ng/L	
`;

const MUESTRA_TROPONINA_ALTA = `
Expediente:	2230539-8
Nombre:	DAVID ALEJANDRO MARTINEZ ALCALA	Fecha Registro:	Jul 7 2026 1:24PM
BANCO DE SANGRE
HsTnl o Troponina I (Alta Sensibilidad)	
45.0
ng/L	
`;

test('looksLikeSomeLabReport reconoce reporte solo troponina', () => {
  assert.equal(looksLikeSomeLabReport(MUESTRA_TROPONINA), true);
});

test('parseTroponina_ extrae hs-cTnI elevada con flag', () => {
  const out = parseTroponina_(MUESTRA_TROPONINA);
  assert.match(out, /^TROP\tTnI 2180\.3\*$/);
});

test('parseTroponina_ devuelve vacío sin troponina', () => {
  assert.equal(parseTroponina_('GLUCOSA EN SANGRE 95 mg/dL'), '');
});

test('troponinaDeltaPct_ calcula cambio porcentual', () => {
  assert.equal(troponinaDeltaPct_(12.5, 45), 260);
  assert.equal(troponinaDeltaPct_(0, 45), null);
});

test('mergeTroponinaResLabRows_ arma par con delta al consolidar', () => {
  const a = parseTroponina_(MUESTRA_TROPONINA_BAJA);
  const b = parseTroponina_(MUESTRA_TROPONINA_ALTA);
  const merged = mergeTroponinaResLabRows_([a, b]);
  assert.match(merged, /^TROP\tTnI1 12\.5 TnI2 45\* Δ% 260%/);
});

test('dedupeConsolidatedLabRows conserva par troponina (no pierde el segundo)', () => {
  const a = parseTroponina_(MUESTRA_TROPONINA_BAJA);
  const b = parseTroponina_(MUESTRA_TROPONINA_ALTA);
  const out = dedupeConsolidatedLabRows([a, b], 'labs');
  assert.equal(out.length, 1);
  assert.match(out[0], /TnI1 12\.5 TnI2 45\* Δ% 260%/);
});

test('buildTroponinaResLabLine_ omite delta con un solo valor', () => {
  assert.equal(
    buildTroponinaResLabLine_([{ display: '8.2', raw: 8.2 }]),
    'TROP\tTnI 8.2'
  );
});

test('procesarLabs incluye bloque TROP para banco de sangre', () => {
  const { resLabs, patient } = procesarLabs(MUESTRA_TROPONINA);
  const trop = resLabs.find((l) => l.startsWith('TROP\t'));
  assert.ok(trop, 'debe incluir bloque TROP');
  assert.match(trop, /TnI 2180\.3\*/);
  assert.equal(patient.expediente, '2230539-8');
  assert.equal(patient.name, 'DAVID ALEJANDRO MARTINEZ ALCALA');
});

test('tendencias: par troponina expone TnI1 y TnI2 por separado', () => {
  const a = parseTroponina_(MUESTRA_TROPONINA_BAJA);
  const b = parseTroponina_(MUESTRA_TROPONINA_ALTA);
  const merged = mergeTroponinaResLabRows_([a, b]);
  const pb = buildParsedBySectionFromResLabs([merged], null);
  assert.equal(pb.TROP.TnI1, 12.5);
  assert.equal(pb.TROP.TnI2, 45);
  assert.equal(pb.TROP['Δ%'], undefined);
});

test('tendencias: troponina suelta se mapea a TnI1', () => {
  const line = parseTroponina_(MUESTRA_TROPONINA);
  const pb = buildParsedBySectionFromResLabs([line], null);
  assert.equal(pb.TROP.TnI1, 2180.3);
  assert.equal(pb.TROP.TnI2, undefined);
});
