/**
 * Snapshot / estado clínico normalization for SOAP text build.
 */

function snapshotVitals(snapshot) {
  return snapshot && typeof snapshot === 'object' && snapshot.vitals && typeof snapshot.vitals === 'object'
    ? snapshot.vitals
    : {};
}

function snapshotIo(snapshot) {
  return snapshot && typeof snapshot === 'object' && snapshot.io && typeof snapshot.io === 'object'
    ? snapshot.io
    : {};
}

function snapshotAlteredAt(snapshot) {
  return snapshot && typeof snapshot === 'object' && snapshot.alteredAt && typeof snapshot.alteredAt === 'object'
    ? snapshot.alteredAt
    : {};
}

function snapshotGlu(snapshot) {
  return snapshot && typeof snapshot === 'object' && Array.isArray(snapshot.glucometrias)
    ? snapshot.glucometrias
    : [];
}

function snapshotBomba(snapshot) {
  return snapshot && typeof snapshot === 'object' && Array.isArray(snapshot.bombaInsulina)
    ? snapshot.bombaInsulina
    : [];
}

function snapshotTempPeakAt(snapshot) {
  return snapshot && typeof snapshot === 'object' && snapshot.tempPeakAt && typeof snapshot.tempPeakAt === 'object'
    ? /** @type {{ recordedAt?: string, time?: string }} */ (snapshot.tempPeakAt)
    : null;
}

/**
 * @param {Record<string, unknown> | null | undefined} estadoClinico
 * @param {unknown} snapshot
 * @param {unknown} balances
 */
export function normalizeEaTextInputs(estadoClinico, snapshot, balances) {
  const ec =
    estadoClinico && typeof estadoClinico === 'object' ? /** @type {Record<string, unknown>} */ (estadoClinico) : {};
  const v = snapshotVitals(snapshot);
  const snapIo = snapshotIo(snapshot);
  const btTurno =
    balances && typeof balances === 'object' ? /** @type {{ balanceTurno?: unknown }} */ (balances).balanceTurno : undefined;
  const snapAlt = snapshotAlteredAt(snapshot);
  const tempPeakAt = snapshotTempPeakAt(snapshot);
  const glSrc = snapshotGlu(snapshot);
  const bombaSrc = snapshotBomba(snapshot);
  return { ec, v, snapIo, btTurno, snapAlt, tempPeakAt, glSrc, bombaSrc };
}
