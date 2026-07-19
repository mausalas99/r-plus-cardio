import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensurePatientAccesos,
  formatAccesosForCenso,
  syncLegacyAccesoFields,
} from './patient-accesos.mjs';

describe('patient-accesos', () => {
  it('migra viaAcceso único a accesosList', () => {
    var p = { viaAcceso: 'picc', accesoFecha: '2026-05-03' };
    ensurePatientAccesos(p);
    assert.equal(p.accesosList.length, 1);
    assert.equal(p.accesosList[0].via, 'picc');
    assert.equal(p.accesosList[0].fecha, '2026-05-03');
  });

  it('formatAccesosForCenso une varios accesos', () => {
    var p = {
      accesosList: [
        { via: 'cvc', fecha: '2026-05-01' },
        { via: 'periferica', fecha: '2026-05-10' },
      ],
    };
    var text = formatAccesosForCenso(p);
    assert.match(text, /CVC.*01\/05\/2026/);
    assert.match(text, /EV periférica.*10\/05\/2026/);
    assert.ok(text.includes('\n'));
  });

  it('syncLegacyAccesoFields prioriza CVC para electrolitos', () => {
    var p = {
      accesosList: [
        { via: 'periferica', fecha: '2026-05-10' },
        { via: 'cvc', fecha: '2026-05-01' },
      ],
    };
    syncLegacyAccesoFields(p);
    assert.equal(p.viaAcceso, 'cvc');
    assert.equal(p.accesoFecha, '2026-05-01');
  });
});
