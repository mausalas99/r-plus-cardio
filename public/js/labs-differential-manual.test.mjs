import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseBH_, procesarLabs } from './labs.js';

const ROGELIO_DIFF_ONLY = `
Expediente:\t1936787-7\tSolicitud:\t2605050735
Nombre:\tROGELIO GONZALEZ ESQUIVEL\tFecha Registro:\tMay 5 2026 4:07PM
Sexo:\tMASCULINO\tUbicación:\tSERVICIO CLÍNICO 2
Edad:\t81\tMedico:\tA QUIEN CORRESPONDA

HEMATOLOGIA
DIFERENCIAL MANUAL
Estudio\t\tResultado\tUnidades\tValor de Referencia
SEGMENTADOS\t
A
77
%\t50 - 70
BANDAS\t
*
1
%\t0 - 5
LINFOCITOS\t
*
17
%\t10 - 50
MONOCITOS\t
*
0
%\t0 - 12
EOSINOFILOS\t
*
4
%\t0 - 7
BASOFILOS\t
*
1
%\t0.0 - 2.5
METAMIELOCITOS\t
*
0
%\t0 - 0
MIELOCITOS\t
*
0
%\t0 - 0
PROMIELOCITOS\t
*
0
%\t0 - 0
BLASTOS\t
*
0
%\t0 - 0
LINF. ATIPICOS\t
*
0
CEL.ROJAS NUCLEADAS\t
*
0
OBSERVACIONES\t
*
PLAQUETAS NORMALES
FROTIS DE SANGRE PERIFERICA
Estudio\t\tResultado\tUnidades\tValor de Referencia
FROTIS DE SANGRE PERIFERICA\t
*
NO HIPOCROMIA.

QUIMICA CLINICA
COLESTEROL
Estudio\t\tResultado\tUnidades\tValor de Referencia
COLESTEROL\t
B
107
mg/dL\t130 - 200
TRIGLICERIDOS
Estudio\t\tResultado\tUnidades\tValor de Referencia
TRIGLICERIDOS\t
A
160
mg/dL\t35 - 150
`;

describe('diferencial manual SOME (sin biometría)', () => {
  it('parseBH_ captura SEGMENTADOS y % del diferencial en visible', () => {
    const { visible, extras } = parseBH_(ROGELIO_DIFF_ONLY);
    assert.strictEqual(extras.NeuPct, '77');
    assert.strictEqual(extras.LinPct, '17');
    assert.strictEqual(extras.EosPct, '4');
    assert.strictEqual(extras.BasoPct, '1');
    assert.strictEqual(extras.Bandas, '1');
    assert.strictEqual(extras.Lin, undefined);
    assert.match(visible, /^BH:/);
    assert.match(visible, /\bDif\./);
    assert.match(visible, /\bSeg\s+77%\*/);
    assert.match(visible, /\bLin\s+17%/);
  });

  it('procesarLabs incluye BH diferencial, QS lipídico y frotis', () => {
    const { resLabs } = procesarLabs(ROGELIO_DIFF_ONLY);
    assert.ok(resLabs.some((l) => /^BH:/.test(l) && /\bSeg\s+77%\*/.test(l)), 'línea BH con diferencial');
    assert.ok(resLabs.some((l) => l.startsWith('QS\t') && /\bCOL\s+107/.test(l)));
    assert.ok(resLabs.some((l) => l.startsWith('FROTIS\t')));
  });
});
