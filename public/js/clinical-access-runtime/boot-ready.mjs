import { isDbMode } from '../db-storage-bridge.mjs';
import {
  clinicalAccessBootDone,
  clinicalAccessBootWaiters,
  setClinicalAccessBootDone,
  setClinicalAccessBootWaiters,
} from './state.mjs';

/** Unblocks LAN room boot after clinical session + scope hydrate (or timeout). */
export function markClinicalAccessBootReady() {
  if (clinicalAccessBootDone) return;
  setClinicalAccessBootDone(true);
  const waiters = clinicalAccessBootWaiters;
  setClinicalAccessBootWaiters([]);
  for (const resolve of waiters) resolve();
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('rpc-clinical-access-ready'));
  }
}

export function waitForClinicalAccessReady() {
  if (!isDbMode() || clinicalAccessBootDone) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 20000);
    clinicalAccessBootWaiters.push(function () {
      clearTimeout(timer);
      resolve();
    });
  });
}
