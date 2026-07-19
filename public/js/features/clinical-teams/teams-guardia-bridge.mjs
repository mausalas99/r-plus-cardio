/**
 * Mi rotación — self-serve teams and membership.
 */
import {
  isBenignLanPushSkipCode,
  LAN_PROFILE_PUSH_FAILED_MSG,
} from '../../clinical-profile-lan-sync.mjs';
import { dbApi, toast } from './shared.mjs';

/** Push teams/membership to sala ⇄ (same path as @usuario; uses sticky room membership). */
export async function publishClinicalTeamsToLan() {
  try {
    const mod = await import('../lan-sync.mjs');
    if (typeof mod.pushClinicalOpsLanNow === 'function') {
      return mod.pushClinicalOpsLanNow();
    }
  } catch {
    /* LAN optional */
  }
  return { ok: false, code: 'NO_LAN' };
}

/** @param {{ ok?: boolean, code?: string }} lanPush */
export function toastTeamLanPublishResult(lanPush, localOkMessage) {
  if (!lanPush) {
    toast(localOkMessage, 'success');
    return;
  }
  if (
    lanPush.ok &&
    (lanPush.code === 'QUEUED' || (lanPush.channels && lanPush.channels.outbox))
  ) {
    toast(
      `${localOkMessage} Se publicará a la sala cuando vuelva la red (cola ⇄).`,
      'info'
    );
    return;
  }
  if (lanPush.ok) {
    if (lanPush.code === 'CONFLICT_RESOLVED') {
      toast(`${localOkMessage} Directorio alineado con el servidor.`, 'success');
      return;
    }
    if (lanPush.channels && lanPush.channels.http) {
      toast(`${localOkMessage} Publicado en sala ⇄.`, 'success');
      return;
    }
    toast(localOkMessage, 'success');
    return;
  }
  if (isBenignLanPushSkipCode(lanPush.code)) {
    toast(`${localOkMessage} (solo en esta Mac hasta conectar sala ⇄).`, 'info');
    return;
  }
  toast(LAN_PROFILE_PUSH_FAILED_MSG, 'warn');
}

const LAN_CLINICAL_OPS_PULL_MIN_MS = 12_000;
let lanClinicalOpsPullLastAt = 0;
/** @type {Promise<boolean>|null} */
let lanClinicalOpsPullInFlight = null;

/** Pull host clinicalOps into this Mac so partner @usuario and teams exist locally. */
export async function pullClinicalOpsFromLanRoom(options = {}) {
  const force = !!options.force;
  const now = Date.now();
  if (!force && now - lanClinicalOpsPullLastAt < LAN_CLINICAL_OPS_PULL_MIN_MS) {
    return false;
  }
  if (lanClinicalOpsPullInFlight) return lanClinicalOpsPullInFlight;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 8000);
  lanClinicalOpsPullInFlight = (async () => {
    try {
      const lan = await import('../lan-sync.mjs');
      if (typeof lan.refreshLanClinicalDirectoryFromRoom !== 'function') return false;
      return !!(await lan.refreshLanClinicalDirectoryFromRoom({ timeoutMs }));
    } catch {
      return false;
    } finally {
      lanClinicalOpsPullLastAt = Date.now();
      lanClinicalOpsPullInFlight = null;
    }
  })();
  return lanClinicalOpsPullInFlight;
}

/** @param {string} handle — normalized @usuario without @ */
export async function resolveLocalUserIdByLanHandle(handle) {
  const api = dbApi();
  if (!api || typeof api.dbClinicalUserLookup !== 'function') return '';
  const res = await api.dbClinicalUserLookup({ username: handle });
  return res?.ok && res.user?.user_id ? String(res.user.user_id) : '';
}
