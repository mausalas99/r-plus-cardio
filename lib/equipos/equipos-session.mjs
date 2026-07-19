/** Shared equipos session status labels and formatter. */

export const EQUIPOS_SESSION_CLOSED_LABELS = {
  return: 'Devolución',
  admin_purge: 'Purgado',
  admin_force_return: 'Forzado',
};

/** @param {object} row */
export function sessionStatus(row) {
  if (!row.returned_at) return 'En curso';
  return EQUIPOS_SESSION_CLOSED_LABELS[row.closed_reason] || 'Cerrado';
}
