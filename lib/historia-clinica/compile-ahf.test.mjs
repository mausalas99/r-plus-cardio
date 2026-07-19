import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAhfSection } from './compile-ahf.mjs';

const catalog = { diabetes: 'Diabetes mellitus', hta: 'Hipertensión arterial' };

test('formatAhfSection groups by condition and relative', () => {
  const body = formatAhfSection(
    {
      entries: [
        {
          conditionId: 'diabetes',
          relativeId: 'madre',
          diagnosis: 'DM2',
          treatment: 'Metformina',
          vitalStatus: 'vivo',
        },
        {
          conditionId: 'diabetes',
          relativeId: 'padre',
          diagnosis: 'DM2',
          vitalStatus: 'fallecido',
          ageAtDeath: 72,
          causeOfDeath: 'IAM',
        },
      ],
      descripcionDetallada: '',
    },
    catalog
  );
  assert.match(body, /Diabetes mellitus/);
  assert.match(body, /Madre.*DM2.*Metformina.*vivo/i);
  assert.match(body, /Padre.*fallecido.*72.*IAM/i);
});

test('formatAhfSection includes additional notes', () => {
  const body = formatAhfSection(
    { entries: [], descripcionDetallada: 'Sin otros antecedentes relevantes.' },
    catalog
  );
  assert.match(body, /Sin otros antecedentes/);
});
