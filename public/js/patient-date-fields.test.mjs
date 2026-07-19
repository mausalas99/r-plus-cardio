import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  accesoFechaToDateInputValue,
  dateInputValueToAccesoFecha,
  formatAccesoFechaDisplay,
} from './patient-date-fields.mjs';

describe('patient-date-fields', () => {
  it('convierte DD/MM/AAAA a ISO para input date', () => {
    assert.equal(accesoFechaToDateInputValue('3/5/2026'), '2026-05-03');
    assert.equal(accesoFechaToDateInputValue('03/05/2026'), '2026-05-03');
  });

  it('conserva ISO y formatea para censo', () => {
    assert.equal(accesoFechaToDateInputValue('2026-05-03'), '2026-05-03');
    assert.equal(formatAccesoFechaDisplay('2026-05-03'), '03/05/2026');
  });

  it('dateInputValueToAccesoFecha solo acepta ISO', () => {
    assert.equal(dateInputValueToAccesoFecha('2026-05-03'), '2026-05-03');
    assert.equal(dateInputValueToAccesoFecha('03/05/2026'), '');
  });
});
