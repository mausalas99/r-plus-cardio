import { trimStr } from './med-receta-util.mjs';
import { getMedCatalogAccentMap } from './med-receta-catalog.mjs';

var ACCENT_FIRST_WORD = {
  LOSARTAN: 'LOSARTÁN',
  ONDANSETRON: 'ONDANSETRÓN',
  SENOSIDOS: 'SENÓSIDOS',
};

export function normalizeNombreForSoapClassify(nombreRaw) {
  var n = String(nombreRaw || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  // Alias clínicos frecuentes para tolerar variantes de captura.
  n = n.replace(/\bONDASETRON\b/g, 'ONDANSETRON');
  return n;
}

export function applyNombreAccents(n) {
  var table = Object.assign({}, ACCENT_FIRST_WORD, getMedCatalogAccentMap());
  var u = n.toUpperCase();
  for (var k in table) {
    if (Object.prototype.hasOwnProperty.call(table, k) && u.indexOf(k) === 0) {
      return table[k] + n.slice(k.length);
    }
  }
  return n;
}

export function normalizeSpacesPct(s) {
  return s.replace(/\s+/g, ' ').replace(/(\d)\s+%/g, '$1%');
}

function stripListaMarkers(nombre) {
  return trimStr(
    nombre
      .replace(/\s*\(\+\*\)\s*$/i, '')
      .replace(/\s*\(\*\)\s*$/i, '')
      .replace(/\s*\(\+\*\)/gi, '')
      .replace(/\s*\(\*\)/gi, '')
  );
}

function expandSolInyClause(n) {
  return n.replace(/\bSOL INY\s+(\d+(?:[.,]\d+)?)\s*ML\b/gi, function (_full, ml, _off, str) {
    var idx = arguments[arguments.length - 2];
    var before = str.slice(0, idx);
    if (/\b50\s*%/i.test(before) && String(ml).replace(',', '.') === '50') {
      return 'SOLUCIÓN INYECTABLE 50 ML';
    }
    return 'SOLUCIÓN INYECTABLE';
  }).replace(/\bSOL INY\b/gi, 'SOLUCIÓN INYECTABLE');
}

export function expandNombrePresentacion(nombre) {
  var n = normalizeSpacesPct(stripListaMarkers(nombre));
  n = expandSolInyClause(n);
  n = n.replace(/\bCOMPRIMIDO\b/gi, 'TABLETA');
  n = n.replace(/\bCAPSULA\b/gi, 'CÁPSULA');
  n = n.replace(/\bCAPSULAS\b/gi, 'CÁPSULAS');
  n = n.replace(/\bJARABE\s+\d+\s*ML\b/gi, 'JARABE');
  n = n.replace(/\bGEL\s+\d+\s*ML\b/gi, 'GEL');
  var m = n.match(/^(POLIETILENGLICOL\s+3350)\s+POLVO\s+(\d+\s*G)\s*$/i);
  if (m) {
    return normalizeSpacesPct(m[1] + ' ' + m[2] + ' POLVO');
  }
  return normalizeSpacesPct(n);
}

export function normalizeVia(viaRaw) {
  var v = trimStr(viaRaw).toUpperCase();
  if (v === 'VIA ORAL') return 'VÍA ORAL';
  if (v === 'VIA INTRAVENOSA') return 'VÍA INTRAVENOSA';
  if (v === 'VIA SUBCUTANEA') return 'VÍA SUBCUTÁNEA';
  return viaRaw;
}

export function verbForVia(viaNorm) {
  if (viaNorm === 'VÍA ORAL') return 'TOMAR';
  if (viaNorm === 'VÍA SUBCUTÁNEA') return 'APLICAR';
  return 'ADMINISTRAR';
}

export function normalizeFrecuencia(fr) {
  var t = trimStr(fr);
  t = t.replace(/\bHRS\b/gi, 'HORAS');
  t = t.replace(/\bHR\b/gi, 'HORA');
  return t;
}