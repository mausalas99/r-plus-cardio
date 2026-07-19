import { applyMedCatalogOverlay } from '../../med-receta-core.mjs';
import { applySomePharmCatalogOverlay } from '../../med-pharm-some-catalog.mjs';
import { storage } from '../../storage.js';

function mergeUniqueTokenLists(storedList, incomingList) {
  return Array.from(new Set([...(storedList || []), ...(incomingList || [])]));
}

function mergeSoapTokenGroups(storedTokens, incomingTokens) {
  const stored = storedTokens || {};
  const incoming = incomingTokens || {};
  return {
    vasop: mergeUniqueTokenLists(stored.vasop, incoming.vasop),
    abx: mergeUniqueTokenLists(stored.abx, incoming.abx),
    analgesia: mergeUniqueTokenLists(stored.analgesia, incoming.analgesia),
    antihta: mergeUniqueTokenLists(stored.antihta, incoming.antihta),
  };
}

/** @param {object} incoming @param {() => object} readStored */
export function mergeMedCatalogPayload(incoming, readStored) {
  const stored = readStored();
  return {
    accents: Object.assign({}, stored.accents || {}, incoming.accents || {}),
    soapTokens: mergeSoapTokenGroups(stored.soapTokens, incoming.soapTokens),
    somePharm: Object.assign({}, stored.somePharm || {}, incoming.somePharm || {}),
  };
}

/** @param {object} payload @param {() => object} readStored */
export function parseMedCatalogImportPayload(payload, readStored) {
  const accents = payload.accents;
  const soapTokens = payload.soapTokens;
  const somePharm = payload.somePharm;
  const hasAcc = accents && typeof accents === 'object';
  const hasSoap = soapTokens && typeof soapTokens === 'object';
  const hasSome = somePharm && typeof somePharm === 'object';
  if (!hasAcc && !hasSoap && !hasSome) {
    return { ok: false, error: 'invalid_catalog' };
  }
  const merged = mergeMedCatalogPayload({
    accents: hasAcc ? accents : {},
    soapTokens: hasSoap ? soapTokens : {},
    somePharm: hasSome ? somePharm : {},
  }, readStored);
  return { ok: true, merged };
}

/** @param {object} merged @param {(action: string, status: string, count: number, detail: string) => void} addAuditEntry */
export function applyMergedMedCatalog(merged, addAuditEntry) {
  storage.saveMedCatalog(merged);
  applyMedCatalogOverlay(merged);
  applySomePharmCatalogOverlay(merged);
  const nAcc = Object.keys(merged.accents || {}).length;
  const nTok =
    (merged.soapTokens.vasop || []).length +
    (merged.soapTokens.abx || []).length +
    (merged.soapTokens.analgesia || []).length +
    (merged.soapTokens.antihta || []).length;
  addAuditEntry('med-catalog-import', 'ok', nTok, 'accents:' + nAcc);
  return { nAcc, nTok };
}
