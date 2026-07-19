import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNmDietClause } from './estado-actual-diet-text.mjs';

test('formatNmDietClause dieta calórica con proteína (EA)', () => {
  const clause = formatNmDietClause(
    { dieta: 'normal picada', kcalKg: '25', proteinG: '70' },
    '1750',
    { includeProtein: true }
  );
  assert.match(clause, /^DIETA NORMAL PICADA CALCULADA A 25 KCAL\/KG \(1750 KCAL\) \+ 70 GR PROTEINA$/);
});

test('formatNmDietClause ayuno sin calorías', () => {
  assert.equal(formatNmDietClause({ dieta: 'AYUNO' }, '2000'), 'DIETA AYUNO');
  assert.equal(
    formatNmDietClause({ dieta: 'AYUNO', kcalKg: '25', proteinG: '60' }, '1750'),
    'DIETA AYUNO'
  );
});

test('formatNmDietClause suplemento sin calorías', () => {
  assert.equal(formatNmDietClause({ dieta: 'SUPLEMENTO' }, '2000'), 'DIETA SUPLEMENTO');
  assert.equal(formatNmDietClause({ dieta: '*SUPLEMENTO' }, '2000'), 'DIETA SUPLEMENTO');
  assert.equal(
    formatNmDietClause({ dieta: 'SUPLEMENTO', kcalKg: '25', proteinG: '60' }, '1750'),
    'DIETA SUPLEMENTO'
  );
  assert.equal(
    formatNmDietClause({ dieta: '*SUPLEMENTO', kcalKg: '25', proteinG: '60' }, '1750'),
    'DIETA SUPLEMENTO'
  );
});

test('formatNmDietClause plantilla SOAP sin proteína', () => {
  const clause = formatNmDietClause(
    { dieta: 'blanda', kcalKg: '30', proteinG: '60' },
    '2100',
    { includeProtein: false }
  );
  assert.equal(clause, 'DIETA BLANDA CALCULADA A 30 KCAL/KG (2100 KCAL)');
  assert.doesNotMatch(clause, /PROTEINA/);
});
