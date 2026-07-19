import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  syncErcMedicationsToApp,
  purgeErcMedicationsFromApp,
  formatErcConditionSuffix,
  ERC_CONDITION_ID,
} from './erc-detail.mjs';

test('syncErcMedicationsToApp copies ERC meds into medicamentos actuales', () => {
  const app = syncErcMedicationsToApp({
    conditions: [ERC_CONDITION_ID],
    conditionDetails: {
      enfermedadRenal: {
        stage: 'g4',
        diagnosis: 'ND',
        treatment: 'Diálisis',
        medications: [
          { id: 'm1', medication: 'Eritropoyetina', route: 'SC', dosage: '40000', frequency: 'sem' },
        ],
      },
    },
    medicamentosActuales: [{ id: 'x', medication: 'Metformina' }],
  });
  assert.equal(app.medicamentosActuales.length, 2);
  assert.equal(app.medicamentosActuales[1].linkedFrom, ERC_CONDITION_ID);
  assert.match(formatErcConditionSuffix(app.conditionDetails.enfermedadRenal), /G4/);
});

test('purgeErcMedicationsFromApp removes linked rows', () => {
  const app = purgeErcMedicationsFromApp({
    medicamentosActuales: [
      { medication: 'A' },
      { medication: 'B', linkedFrom: ERC_CONDITION_ID },
    ],
    conditionDetails: { enfermedadRenal: { stage: 'g3a' } },
  });
  assert.equal(app.medicamentosActuales.length, 1);
  assert.equal(app.conditionDetails.enfermedadRenal, undefined);
});
