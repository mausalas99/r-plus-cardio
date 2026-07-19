import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySomePharmCategory,
  applySomePharmCatalogOverlay,
  listSomePharmFilterLabels,
  rowSomePharmCategory,
  assignSomePharmCategory,
} from './med-pharm-some-catalog.mjs';

describe('classifySomePharmCategory', () => {
  it('clasifica antibiótico y sedante por defecto', () => {
    applySomePharmCatalogOverlay(null);
    assert.equal(classifySomePharmCategory('ERTAPENEM 1 G SOL INY'), 'ANTIBIÓTICO');
    assert.equal(classifySomePharmCategory('DEXMEDETOMIDINA 200 MCG'), 'SEDANTE');
  });

  it('respeta tokens personalizados del overlay', () => {
    applySomePharmCatalogOverlay({
      somePharm: { tokens: { SEDANTE: ['MISEDANTEUNICO'] } },
    });
    assert.equal(classifySomePharmCategory('MISEDANTEUNICO 10 MG'), 'SEDANTE');
  });
});

describe('listSomePharmFilterLabels', () => {
  it('empieza con TODOS y sigue orden SOME del hospital', () => {
    const labels = listSomePharmFilterLabels();
    assert.equal(labels[0], 'TODOS');
    assert.equal(labels[1], 'AGONISTA ALFA/BETA');
    assert.equal(labels[labels.length - 1], 'OTROS');
    assert.equal(labels.length, 24);
    assert.ok(labels.indexOf('SUEROS') > 0);
    assert.ok(labels.indexOf('SUPLEMENTO ELECTROLÍTICO') > 0);
  });
});

describe('rowSomePharmCategory', () => {
  it('prefiere catOverride', () => {
    const row = { med: 'ERTAPENEM', cat: 'OTROS', catOverride: 'ANTIBIÓTICO' };
    assert.equal(rowSomePharmCategory(row), 'ANTIBIÓTICO');
  });

  it('assignSomePharmCategory rellena cat sin override', () => {
    applySomePharmCatalogOverlay(null);
    const row = assignSomePharmCategory({ med: 'METAMIZOL 2.5 G' });
    assert.equal(row.cat, 'ANALGÉSICO');
    assert.equal(row.catOverride, undefined);
  });
});
