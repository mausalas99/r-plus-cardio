var MAX_CUSTOM_TOKENS_PER_CAT = 400;
var MAX_CUSTOM_TOKEN_LEN = 120;
var MAX_CUSTOM_ACCENTS = 500;

var _catalogOverlay = {
  accents: {},
  soapTokens: { vasop: [], abx: [], analgesia: [], antihta: [] },
};

function sanitizeAccentMap(raw) {
  var out = Object.create(null);
  if (!raw || typeof raw !== 'object') return out;
  var n = 0;
  for (var k in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    if (n >= MAX_CUSTOM_ACCENTS) break;
    var key = String(k || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
    if (!key) continue;
    var val = String(raw[k] == null ? '' : raw[k]).trim();
    if (!val) continue;
    if (val.length > 80) val = val.slice(0, 80);
    out[key] = val;
    n += 1;
  }
  return out;
}

function sanitizeTokenList(arr) {
  if (!Array.isArray(arr)) return [];
  var out = [];
  var seen = Object.create(null);
  for (var i = 0; i < arr.length && out.length < MAX_CUSTOM_TOKENS_PER_CAT; i += 1) {
    var t = String(arr[i] || '').trim();
    if (t.length > MAX_CUSTOM_TOKEN_LEN) t = t.slice(0, MAX_CUSTOM_TOKEN_LEN);
    if (!t) continue;
    var k = t.toUpperCase();
    if (seen[k]) continue;
    seen[k] = 1;
    out.push(t);
  }
  return out;
}

/**
 * Ajustes personalizados: acentos al inicio del nombre y tokens extra para clasificación SOAP.
 * Llamar tras cargar o importar desde almacenamiento.
 */
export function applyMedCatalogOverlay(raw) {
  var o = raw && typeof raw === 'object' ? raw : {};
  var soap = o.soapTokens && typeof o.soapTokens === 'object' ? o.soapTokens : {};
  _catalogOverlay = {
    accents: sanitizeAccentMap(o.accents),
    soapTokens: {
      vasop: sanitizeTokenList(soap.vasop),
      abx: sanitizeTokenList(soap.abx),
      analgesia: sanitizeTokenList(soap.analgesia),
      antihta: sanitizeTokenList(soap.antihta),
    },
  };
}

export function getMedCatalogOverlaySnapshot() {
  return {
    accents: Object.assign({}, _catalogOverlay.accents),
    soapTokens: {
      vasop: _catalogOverlay.soapTokens.vasop.slice(),
      abx: _catalogOverlay.soapTokens.abx.slice(),
      analgesia: _catalogOverlay.soapTokens.analgesia.slice(),
      antihta: _catalogOverlay.soapTokens.antihta.slice(),
    },
  };
}

/** @returns {Record<string, string>} */
export function getMedCatalogAccentMap() {
  return _catalogOverlay.accents;
}

/** @returns {{ vasop: string[], abx: string[], analgesia: string[], antihta: string[] }} */
export function getMedCatalogSoapTokens() {
  return _catalogOverlay.soapTokens;
}
