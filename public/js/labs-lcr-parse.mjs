import { toNum_ } from './labs-extract.mjs';
import { parseFluidLeu_, parseLcrProteinMgdl_ } from './labs-fluid-interpret-values.mjs';
import {
  emptyLcrFields_,
  scanLcrLine_,
  lcrFieldsEmpty_,
  buildLcrLine_,
  isInvalidLcrTextField_,
} from './labs-lcr-scan.mjs';

/** All citoquímico LCR blocks in a SOME report (química + bacteriología). */
export function collectLcrBlocks_(textoBruto) {
  var t = String(textoBruto || '');
  var blocks = [];
  var mChem = t.match(/CITOQUIMICO\s+DE\s+LCR[\s\S]*?(?=BACTERIOLOGIA|CUADERNILLO|$)/i);
  if (mChem) blocks.push(mChem[0]);
  var mMicro = t.match(/CITOQUIMICO\s+LIQ\.?\s+LCR[\s\S]*?(?=CUADERNILLO|$)/i);
  if (mMicro) {
    var micro = mMicro[0];
    var dup = blocks.some(function (b) {
      return b === micro;
    });
    if (!dup) blocks.push(micro);
  }
  return blocks;
}

/** Normalized blob(s) for stripping LCR from QS / chemistry parsers. */
export function lcrBlocksNormText_(textoBruto) {
  return collectLcrBlocks_(textoBruto).map(function (b) {
    return b.replace(/\r/g, '').replace(/\s+/g, ' ');
  });
}

function parseLcrFieldsFromBlock_(bloque) {
  var lineas = bloque.split(/\r?\n/).map(function (l) {
    return l.trim();
  });
  var fields = emptyLcrFields_();
  for (var i = 0; i < lineas.length; i++) {
    scanLcrLine_(fields, lineas, i, lineas[i].toUpperCase(), lineas[i]);
  }
  return fields;
}

function mergeLcrScalar_(accVal, nextVal) {
  if (nextVal === '' || nextVal == null) return accVal;
  if (accVal === '' || accVal == null) return nextVal;
  return accVal;
}

function mergeLcrText_(accVal, nextVal) {
  if (nextVal === '' || nextVal == null) return accVal;
  if (accVal === '' || accVal == null || isInvalidLcrTextField_(accVal)) return nextVal;
  return accVal;
}

function mergeLcrLeu_(accVal, nextVal) {
  if (nextVal === '' || nextVal == null) return accVal;
  if (accVal === '' || accVal == null) return nextVal;
  return accVal;
}

/** Merge chemistry + micro blocks; micro fills gaps and replaces label bleed. */
export function mergeLcrFields_(blocks) {
  var merged = emptyLcrFields_();
  for (var b = 0; b < blocks.length; b++) {
    var next = parseLcrFieldsFromBlock_(blocks[b]);
    merged.pH = mergeLcrScalar_(merged.pH, next.pH);
    merged.aspecto = mergeLcrText_(merged.aspecto, next.aspecto);
    merged.leu = mergeLcrLeu_(merged.leu, next.leu);
    merged.glu = mergeLcrScalar_(merged.glu, next.glu);
    merged.prot = mergeLcrScalar_(merged.prot, next.prot);
    merged.cl = mergeLcrScalar_(merged.cl, next.cl);
    merged.gram = mergeLcrText_(merged.gram, next.gram);
    merged.tinta = mergeLcrText_(merged.tinta, next.tinta);
  }
  return merged;
}

function fieldsToLcrParsed_(fields) {
  if (lcrFieldsEmpty_(fields)) return null;
  return {
    line: buildLcrLine_(fields),
    pH: toNum_(fields.pH),
    aspecto: fields.aspecto || '',
    leu: fields.leu === '' ? null : parseFluidLeu_(fields.leu),
    glu: toNum_(fields.glu),
    protMgdl: parseLcrProteinMgdl_(fields.prot),
    cl: toNum_(fields.cl),
    gram: fields.gram || '',
    tinta: fields.tinta || '',
  };
}

/**
 * @param {string} textoBruto
 * @returns {object|null}
 */
export function parseLcrParsed(textoBruto) {
  var blocks = collectLcrBlocks_(textoBruto);
  if (!blocks.length) return null;
  return fieldsToLcrParsed_(mergeLcrFields_(blocks));
}

export function parsearLCR(textoBruto) {
  var parsed = parseLcrParsed(textoBruto);
  return parsed && parsed.line ? parsed.line : '';
}
