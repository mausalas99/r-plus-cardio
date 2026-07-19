import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  areDriveLabSetsEquivalent,
  calendarDayKeyFromLabSet,
  isDuplicateDriveLabSet,
  filterNewDriveLabSets,
} from './merge-drive-labs.mjs';

test('calendarDayKeyFromLabSet ignora hora para el día', () => {
  assert.equal(
    calendarDayKeyFromLabSet({ fecha: '01/06/2026', hora: '04:23' }),
    calendarDayKeyFromLabSet({ fecha: '01/06/2026', hora: '' }),
  );
});

test('isDuplicateDriveLabSet mismo día y mismas líneas aunque cambie hora', () => {
  const lines = ['BH\tHb 8.95* Hto 29.5*'];
  const a = { fecha: '01/06/2026', hora: '04:23', resLabs: lines };
  const b = { fecha: '01/06/2026', hora: '', resLabs: lines };
  assert.equal(isDuplicateDriveLabSet(a, b), true);
});

test('isDuplicateDriveLabSet mismo día si incoming es subconjunto', () => {
  const existing = {
    fecha: '01/06/2026',
    hora: '04:23',
    resLabs: ['BH\tHb 8.95*', 'QS\tGlu 77'],
  };
  const incoming = {
    fecha: '01/06/2026',
    hora: '10:00',
    resLabs: ['BH\tHb 8.95*'],
  };
  assert.equal(isDuplicateDriveLabSet(existing, incoming), true);
});

test('isDuplicateDriveLabSet false si incoming aporta líneas nuevas el mismo día', () => {
  const existing = {
    fecha: '01/06/2026',
    hora: '',
    resLabs: ['BH\tHb 8.95*'],
  };
  const incoming = {
    fecha: '01/06/2026',
    hora: '04:23',
    resLabs: ['BH\tHb 8.95*', 'QS\tGlu 77'],
  };
  assert.equal(isDuplicateDriveLabSet(existing, incoming), false);
});

test('filterNewDriveLabSets omite drive repetido mismo día sin hora', () => {
  const existing = [
    {
      fecha: '02/06/2026',
      hora: '04:23',
      resLabs: ['BH\tHb 8.95* Hto 29.5*'],
    },
  ];
  const incoming = [
    {
      fecha: '02/06/2026',
      hora: '',
      resLabs: ['BH\tHb 8.95* Hto 29.5*'],
    },
  ];
  const filtered = filterNewDriveLabSets(existing, incoming);
  assert.equal(filtered.skipped, 1);
  assert.equal(filtered.sets.length, 0);
});

test('areDriveLabSetsEquivalent sin cambios', () => {
  assert.equal(
    areDriveLabSetsEquivalent(['BH  Hb  8.95'], ['BH Hb 8.95']),
    true,
  );
});
