import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { serializePendientesJson } from './entrega-pendientes.mjs';
import { defaultHandoffContext } from './entrega-handoff-context.mjs';
import { entregaChipMarkerIds, resolveEntregaChipMarkers } from './entrega-chip-markers.mjs';

describe('entregaChipMarkerIds', () => {
  it('returns CR NF SH when all set', () => {
    const handoff = defaultHandoffContext();
    handoff.signedRefusal = true;
    handoff.show = true;
    const json = serializePendientesJson({ version: 2, handoffContext: handoff, items: [] });
    const ids = entregaChipMarkerIds({ is_critical: 1, pendientes_json: json });
    assert.deepEqual(ids, ['critico', 'negativas', 'show']);
  });

  it('resolveEntregaChipMarkers maps labels', () => {
    const markers = resolveEntregaChipMarkers(['negativas', 'show']);
    assert.deepEqual(
      markers.map((m) => m.label),
      ['NF', 'SH']
    );
  });
});
