/** Patient card display key parts (extracted for complexity budget). */

function roundSeenBit(p, ctx) {
  if (!ctx.isRonda || typeof ctx.isRoundSeen !== 'function') return 0;
  return ctx.isRoundSeen(String(p.id || '')) ? 1 : 0;
}

function activeBit(p, ctx) {
  return String(ctx.activeId || '') === String(p.id || '') ? 1 : 0;
}

/** @param {object} p @param {{ activeId?: string|null, isRonda?: boolean, isRoundSeen?: (id: string) => boolean }} ctx */
export function patientCardDisplayKey(p, ctx = {}) {
  return [
    String(p.id || ''),
    String(p.nombre || ''),
    String(p.cuarto || ''),
    String(p.cama || ''),
    String(p.servicio || ''),
    p.pinned ? 1 : 0,
    p.archived ? 1 : 0,
    roundSeenBit(p, ctx),
    activeBit(p, ctx),
  ].join('\u0001');
}
