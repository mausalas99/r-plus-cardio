import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LAB_CONSOLIDATION_WINDOW_MS,
  clusterByTimeWindow,
  clusterByDayTipoAndTimeWindow,
  clusterLabworkByTimeWindow,
} from './lab-consolidation-cluster.mjs';

describe('lab-consolidation-cluster', () => {
  it('clusterByTimeWindow une tomas consecutivas ≤2 h', () => {
    var items = [
      { id: 'a', ms: 0 },
      { id: 'b', ms: 90 * 60 * 1000 },
      { id: 'c', ms: 5 * 60 * 60 * 1000 },
    ];
    var clusters = clusterByTimeWindow(items, function (x) {
      return x.ms;
    });
    assert.equal(clusters.length, 2);
    assert.deepEqual(
      clusters[0].map(function (x) {
        return x.id;
      }),
      ['a', 'b']
    );
    assert.deepEqual(
      clusters[1].map(function (x) {
        return x.id;
      }),
      ['c']
    );
  });

  it('clusterByTimeWindow respeta límite exacto de 2 h', () => {
    var items = [
      { id: 'a', ms: 0 },
      { id: 'b', ms: LAB_CONSOLIDATION_WINDOW_MS },
    ];
    var clusters = clusterByTimeWindow(items, function (x) {
      return x.ms;
    });
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].length, 2);
  });

  it('clusterLabworkByTimeWindow une labs+gaso pero no gaso+gaso', () => {
    var items = [
      { id: 'labs', tipo: 'labs', ms: 0 },
      { id: 'gaso1', tipo: 'gaso', ms: 30 * 60 * 1000 },
      { id: 'gaso2', tipo: 'gaso', ms: 90 * 60 * 1000 },
    ];
    var clusters = clusterLabworkByTimeWindow(
      items,
      function (x) {
        return x.ms;
      },
      function (x) {
        return x.tipo === 'gaso';
      }
    );
    assert.equal(clusters.length, 2);
    assert.deepEqual(
      clusters[0].map(function (x) {
        return x.id;
      }),
      ['labs', 'gaso1']
    );
    assert.deepEqual(
      clusters[1].map(function (x) {
        return x.id;
      }),
      ['gaso2']
    );
  });

  it('clusterByDayTipoAndTimeWindow agrupa labs y gaso del mismo día', () => {
    var items = [
      { day: '2026-6-12', tipo: 'labs', ms: 0 },
      { day: '2026-6-12', tipo: 'gaso', ms: 30 * 60 * 1000 },
      { day: '2026-6-12', tipo: 'cultivo', ms: 45 * 60 * 1000 },
      { day: '2026-6-13', tipo: 'labs', ms: 0 },
    ];
    var clusters = clusterByDayTipoAndTimeWindow(
      items,
      function (x) {
        return x.day;
      },
      function (x) {
        return x.tipo;
      },
      function (x) {
        return x.ms;
      }
    );
    assert.equal(clusters.length, 3);
    assert.equal(clusters[0].length, 2);
    assert.equal(clusters[1].length, 1);
    assert.equal(clusters[2].length, 1);
  });

  it('clusterByDayTipoAndTimeWindow no mezcla tipos ni días', () => {
    var items = [
      { day: '2026-6-12', tipo: 'labs', ms: 0 },
      { day: '2026-6-12', tipo: 'labs', ms: 30 * 60 * 1000 },
      { day: '2026-6-13', tipo: 'labs', ms: 0 },
    ];
    var clusters = clusterByDayTipoAndTimeWindow(
      items,
      function (x) {
        return x.day;
      },
      function (x) {
        return x.tipo;
      },
      function (x) {
        return x.ms;
      }
    );
    assert.equal(clusters.length, 2);
    assert.equal(clusters[0].length, 2);
    assert.equal(clusters[1].length, 1);
  });
});
