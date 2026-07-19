import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { procesarLabs, parseBH_ } from './labs.js';

const ROGELIO_MAY15 = `
Expediente:\t1936787-7\tSolicitud:\t2605150542
Nombre:\tROGELIO GONZALEZ ESQUIVEL\tFecha Registro:\tMay 15 2026 11:31AM
HEMATOLOGIA
DIFERENCIAL MANUAL
SEGMENTADOS\tA\n71\n%\t50 - 70
LINFOCITOS\t*\n25\n%\t10 - 50
METAMIELOCITOS\tA\n3\n%\t0 - 0
OBSERVACIONES\t*\nPLAQUETAS DISMINUIDAS ++.
TIEMPO DE PROTROMBINA Y TROMBOPLASTINA
TIEMPO DE PROTROMBINA\tA\n14.20\nSEG.\t10.25 - 13.20
INR\t*\n1.22
TIEMPO DE TROMBOPLASTINA\t*\n30.9\nSEG\t29.1 - 38.4
FIBRINOGENO
FIBRINOGENO\tA\n405\nmg/dL\t150 - 400
FROTIS DE SANGRE PERIFERICA
FROTIS DE SANGRE PERIFERICA\t*\nHIPOCROMIA + .
DIMERO D
DIMERO D\tA\n2227\nng/mL\t0.0 - 500.0
`;

describe('diferencial manual + coagulación SOME', () => {
  it('parseBH_ muestra diferencial (Seg = segmentados) y coag en fila COAG', () => {
    const { visible, coagVisible, extras } = parseBH_(ROGELIO_MAY15);
    assert.match(visible, /^BH:/);
    assert.match(visible, /\bDif\./);
    assert.match(visible, /\bSeg\s+71%\*/);
    assert.match(visible, /\bLin\s+25%/);
    assert.match(visible, /\bMeta\s+3%/);
    assert.doesNotMatch(visible, /\bCoag\./);
    assert.match(coagVisible, /^COAG\t/);
    assert.match(coagVisible, /\bTP\s+14\.2/);
    assert.match(coagVisible, /\bFib\s+405/);
    assert.match(coagVisible, /\bDD\s+2227/);
    assert.strictEqual(extras.NeuPct, '71');
    assert.strictEqual(extras.Metamielo, '3');
  });

  it('procesarLabs incluye BH, COAG, FROTIS calidad y plaquetas', () => {
    const { resLabs } = procesarLabs(ROGELIO_MAY15);
    const bh = resLabs.find((l) => /^BH:/.test(l) || /^BH\t/.test(l));
    assert.ok(bh, 'línea BH');
    assert.match(bh, /\bSeg\s+71%\*/);
    const coag = resLabs.find((l) => /^COAG\t/.test(l));
    assert.ok(coag, 'línea COAG');
    assert.match(coag, /Fib/);
    assert.match(coag, /DD/);
    const frotis = resLabs.filter((l) => l.startsWith('FROTIS\t')).join('\n');
    assert.ok(frotis.includes('HIPOCROMIA') || frotis.includes('PLAQUETAS DISMINUIDAS'));
  });

  it('mismo día separa solicitudes con >2 h de diferencia (intradía)', async () => {
    const { mergeBulkParseResults } = await import('./lab-bulk-paste.mjs');
    const bh = `Expediente:\t1\tFecha Registro:\tJun 12 2026 5:08AM
BIOMETRIA HEMATICA COMPLETA
WBC\t A 14.40 K/uL 4.10 - 11.10
HGB\t * 16.80 g/dL 13.60 - 17.80`;
    const dd = `Expediente:\t1\tFecha Registro:\tJun 12 2026 12:22AM
HEMATOLOGIA
DIMERO D
DIMERO D\t A 2276 ng/mL 0.0 - 500.0`;
    const items = [bh, dd].map((text) => ({ result: procesarLabs(text), reportText: text }));
    const merged = mergeBulkParseResults(items);
    assert.equal(merged.length, 2);
    const bhSet = merged.find((m) => m.resLabs.some((l) => /^BH\b/i.test(l)));
    const coagSet = merged.find((m) => m.resLabs.some((l) => /^COAG\t/i.test(l)));
    assert.ok(bhSet, 'conjunto BH');
    assert.ok(coagSet, 'conjunto COAG/DD');
    const bhLine = bhSet.resLabs.find((l) => /^BH\b/i.test(l));
    assert.match(bhLine, /Leu\s+14\.4/);
    assert.doesNotMatch(bhLine, /DD\s+2276/);
    const coagLine = coagSet.resLabs.find((l) => /^COAG\t/i.test(l));
    assert.match(coagLine, /DD\s+2276/);
  });
});
