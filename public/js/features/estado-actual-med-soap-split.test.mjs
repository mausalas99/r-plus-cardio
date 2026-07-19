import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partitionAnalgesiaForSoap, partitionNmMedsForSoap } from './estado-actual-med-soap-split.mjs';

test('partitionAnalgesiaForSoap separa antieméticos', () => {
  var split = partitionAnalgesiaForSoap(
    'KETOROLACO 30MG IV C/8H | ONDANSETRON 8MG IV C/8H | PARACETAMOL 1G IV C/8H'
  );
  assert.match(split.analgesia, /KETOROLACO/i);
  assert.match(split.analgesia, /PARACETAMOL/i);
  assert.doesNotMatch(split.analgesia, /ONDANSETRON/i);
  assert.match(split.antiemeticos, /ONDANSETRON/i);
});

test('partitionNmMedsForSoap separa insulina, rescates y otros NM', () => {
  var split = partitionNmMedsForSoap(
    'RESCATES DE INSULINA | OMEPRAZOL 40MG IV C/24H | METFORMINA 850MG VO C/24H'
  );
  assert.equal(split.rescatesDisponibles, true);
  assert.equal(split.insulin, '');
  assert.match(split.other, /OMEPRAZOL/i);
  assert.match(split.other, /METFORMINA/i);
  assert.doesNotMatch(split.other, /RESCATES DE INSULINA/i);
});
