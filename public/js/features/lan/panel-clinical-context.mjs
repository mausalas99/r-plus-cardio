/**
 * Clinical session helpers for LAN panel render — extracted from panel.mjs.
 */
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { lanClient } from './runtime.mjs';

export function getClinicalSettings() {
  try {
    return JSON.parse(localStorage.getItem('rpc-settings') || '{}');
  } catch {
    return {};
  }
}

export function getClinicalRank() {
  var s = getClinicalSettings();
  return String(s.clinicalRank || '').trim();
}

export function getUserSala() {
  var s = getClinicalSettings();
  return String(s.clinicalSala || '').trim();
}

export function isClinicalRegistered() {
  var s = getClinicalSettings();
  return s.clinicalRegistered === true;
}

export function getClinicalUserUserId() {
  try {
    var user = typeof clinicalSessionContext !== 'undefined' ? clinicalSessionContext.user : null;
    return user ? String(user.user_id || '') : '';
  } catch {
    return '';
  }
}

export function isLanHostActive() {
  return !!lanClient.connected;
}
