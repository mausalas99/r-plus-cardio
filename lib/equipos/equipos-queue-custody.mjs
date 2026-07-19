import { EquiposError } from './equipos-errors.mjs';

/**
 * @param {Array<{ reporter_name: string, rotation: string }>} waitlist
 * @param {string} name
 * @param {string} rot
 */
export function waitlistIndexFor(waitlist, name, rot) {
  return (waitlist || []).findIndex((r) => r.reporter_name === name && r.rotation === rot);
}

/**
 * @param {Array<{ reporter_name: string, rotation: string }>} waitlist
 * @param {string} name
 * @param {string} rot
 * @param {boolean} [forceBypass]
 */
export function resolveCheckoutQueueGate(waitlist, name, rot, forceBypass = false) {
  const list = waitlist || [];
  if (!list.length) {
    return { bypassed: false, notifyWaitlist: [] };
  }
  const idx = waitlistIndexFor(list, name, rot);
  if (idx === 0) {
    return { bypassed: false, notifyWaitlist: [] };
  }
  if (!forceBypass) {
    if (idx < 0) {
      throw new EquiposError('not_in_queue', 'No estás en la cola para este dispositivo.');
    }
    throw new EquiposError('not_next_in_queue', 'No eres el siguiente en la cola.');
  }
  return { bypassed: true, notifyWaitlist: list };
}

/** @param {string} status */
export function canJoinEquiposWaitlist(status) {
  return status === 'in_use' || status === 'available';
}

/**
 * @param {Array<{ reporter_name: string, rotation: string }>} rows
 * @param {string} takerName
 * @param {string} takerRotation
 */
export function waitlistRowsForBypassNotify(rows, takerName, takerRotation) {
  return (rows || []).filter(
    (row) => !(row.reporter_name === takerName && row.rotation === takerRotation)
  );
}
