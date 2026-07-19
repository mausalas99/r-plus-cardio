import { isPurgeableHostCensusRow, isHostPatientOwnedByOtherClient } from './host-patients-annotate.mjs';
import { createPurgeGhostsBackup } from './host-patients-purge-backup.mjs';
import { getLanClientId } from './runtime.mjs';
import { purgeLanPatientFromHost } from './patient-delete.mjs';

function purgeOptsForCensusItem(item) {
  return {
    registro: String(item?.row?.registro || '').trim(),
    bundleOnly: item?.row?._bundleOnly === true,
    hostOnly: true,
  };
}

/** @param {Array<object>} rows */
export function partitionPurgeableGhosts(rows) {
  const localClientId = getLanClientId();
  const ghosts = (rows || []).filter(function (x) {
    return isPurgeableHostCensusRow(x, localClientId);
  });
  const foreignGhostCount = (rows || []).filter(function (x) {
    return x.status === 'ghost' && isHostPatientOwnedByOtherClient(x.row, getLanClientId());
  }).length;
  return { ghosts, foreignGhostCount };
}

/**
 * @param {Array<object>} ghosts
 * @param {(msg: string, type?: string) => void} showToast
 */
export async function purgeGhostRowsFromHost(ghosts, _showToast) {
  let ok = 0;
  for (const g of ghosts) {
    const res = await purgeLanPatientFromHost(String(g.row.id), purgeOptsForCensusItem(g));
    if (res?.ok) ok += 1;
  }
  return ok;
}

/**
 * @param {{ localPatientCount?: number, hostPatientCount?: number, fileName?: string, storedLocally?: boolean }} [backup]
 * @returns {string}
 */
export function buildPurgeGhostsConfirmMessage(ghostCount, localCount, backupNote) {
  let msg =
    '¿Quitar ' +
    ghostCount +
    ' fila(s) huérfana(s) solo del anfitrión LAN?\n\n' +
    'No borra pacientes en este Mac ni en otros equipos del turno; solo limpia copias del host sin censo local.\n\n' +
    'Se descargará un respaldo automático de todos los pacientes registrados antes de continuar.';
  if (localCount === 0 && ghostCount >= 5) {
    msg +=
      '\n\n⚠ Tu censo local está vacío: los ' +
      ghostCount +
      ' pacientes del host parecerán fantasmas. El respaldo incluye copia del anfitrión para recuperación.';
  }
  if (backupNote) msg += '\n\n' + backupNote;
  return msg;
}

/** @param {number} ok @param {number} total @param {number} foreignGhostCount @param {(msg: string, type?: string) => void} showToast @param {{ fileName?: string }} [backup] */
export function reportGhostPurgeResult(ok, total, foreignGhostCount, showToast, backup) {
  if (!ok) {
    showToast('No se pudieron eliminar los fantasmas del anfitrión.', 'error');
    return;
  }
  let msg = ok + ' fantasma(s) quitado(s) del anfitrión (solo host).';
  if (foreignGhostCount) msg += ' ' + foreignGhostCount + ' de otro equipo sin cambios.';
  if (backup?.fileName) {
    msg += ' Respaldo: ' + backup.fileName + '.';
  }
  showToast(msg, ok < total ? 'warn' : 'success');
}

/**
 * Backup all registered patients, then purge ghost rows from the host.
 * @param {Array<object>} rows
 * @param {(msg: string, type?: string) => void} showToast
 * @returns {Promise<{ ok: number, total: number, foreignGhostCount: number, backup: object|null }>}
 */
export async function backupAndPurgeGhostRowsFromHost(rows, showToast) {
  const { ghosts, foreignGhostCount } = partitionPurgeableGhosts(rows);
  if (!ghosts.length) {
    return { ok: 0, total: 0, foreignGhostCount, backup: null, empty: true };
  }
  let backup = null;
  try {
    backup = await createPurgeGhostsBackup();
    if (!backup.storedLocally) {
      showToast('Respaldo descargado; no cabe copia local en el navegador.', 'warn');
    }
  } catch (_err) {
    void _err;
    if (
      !window.confirm(
        'No se pudo crear el respaldo automático.\n\n¿Continuar con «Eliminar fantasmas» sin respaldo?'
      )
    ) {
      return { ok: 0, total: ghosts.length, foreignGhostCount, backup: null, cancelled: true };
    }
  }
  const ok = await purgeGhostRowsFromHost(ghosts, showToast);
  return { ok, total: ghosts.length, foreignGhostCount, backup };
}
