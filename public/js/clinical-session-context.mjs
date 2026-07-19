/**
 * Shared clinical session bag — leaf module (no imports) to avoid ESM cycles
 * with LAN orchestrator / guardia-board / clinical-access-runtime.
 */

/** @type {{ user: object|null, guardias: object[], guardiasMap: Map<string, object>, teams: object[], scopeContext: object|null, guardiaMode: boolean, decryptedPrivateKeyPem: string|null, lastBlockHashByPatient: Map<string, string> }} */
export const clinicalSessionContext = {
  user: null,
  guardias: [],
  guardiasMap: new Map(),
  orphanGuardias: [],
  teams: [],
  scopeContext: null,
  guardiaMode: false,
  decryptedPrivateKeyPem: null,
  lastBlockHashByPatient: new Map(),
};

/** Active clinical user id (session bag, then rpc-settings fallback). */
export function resolveClinicalSessionUserId() {
  const fromCtx = String(clinicalSessionContext.user?.user_id || '').trim();
  if (fromCtx) return fromCtx;
  if (typeof localStorage === 'undefined') return '';
  try {
    const settings = JSON.parse(localStorage.getItem('rpc-settings') || '{}');
    return String(settings.clinicalUserId || '').trim();
  } catch {
    return '';
  }
}
