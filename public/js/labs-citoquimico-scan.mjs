// Line scanners for citoquímico de líquidos corporales (complexity split).

/** @returns {object} */
export function emptyCitoquimicoFields_() {
  return {
    fluid: '',
    dens: '',
    pH: '',
    glu: '',
    prot: '',
    ldh: '',
    alb: '',
    tgl: '',
    amil: '',
    aspecto: '',
    leu: '',
    rec: '',
    pmn: '',
    linf: '',
    eri: '',
    gram: '',
    com: '',
  };
}

/**
 * @param {string[]} lineas
 * @param {number} i0
 * @param {number} maxJ
 */
export function nextMeaningfulLine_(lineas, i0, maxJ) {
  for (var j = i0 + 1; j < Math.min(i0 + maxJ, lineas.length); j++) {
    var txt = lineas[j].replace(/\*/g, '').trim();
    if (!txt) continue;
    if (/^ESTUDIO|RESULTADO|UNIDADES|VALOR DE REFERENCIA$/i.test(txt)) continue;
    return txt;
  }
  return '';
}

function scanNumericAfter_(lineas, i, maxLook) {
  for (var j = i + 1; j < Math.min(i + maxLook, lineas.length); j++) {
    var m = lineas[j].match(/(\d+(\.\d+)?)/);
    if (m) return m[1];
  }
  return '';
}

function scanNumericSkipLetterFlag_(lineas, i, maxLook) {
  for (var j = i + 1; j < Math.min(i + maxLook, lineas.length); j++) {
    var c = lineas[j].replace(/\*/g, '').trim();
    if (/^[A-Z]$/i.test(c)) continue;
    var m = c.match(/(\d+(\.\d+)?)/);
    if (m) return m[1];
  }
  return '';
}

function scanCitoFluidType_(fields, lineas, i, lin) {
  if (/^CITOQUIMICO DE\s*$/i.test(lin) && !/CORPORALES/i.test(lin)) {
    var f = nextMeaningfulLine_(lineas, i, 6);
    if (f && !/^:$/.test(f)) fields.fluid = f.toUpperCase();
  }
  if (/^CITOQUIMICO DE\s+/i.test(lin) && !/CORPORALES/i.test(lin)) {
    var mTipo = lin.match(/^CITOQUIMICO DE\s+(.+)$/i);
    if (mTipo && mTipo[1].trim()) fields.fluid = mTipo[1].trim().toUpperCase();
  }
}

function scanCitoChemistry_(fields, lineas, i, lin, linUp) {
  if (linUp.indexOf('DENSIDAD') === 0) fields.dens = scanNumericAfter_(lineas, i, 5);
  if (linUp === 'PH' || linUp.indexOf('PH\t') === 0) fields.pH = scanNumericAfter_(lineas, i, 5);
  if (linUp.indexOf('GLUCOSA') === 0) fields.glu = scanNumericAfter_(lineas, i, 5);
  if (linUp.indexOf('PROTEINAS') === 0) {
    var mL = lin.match(/PROTEINAS\s*([A-Z])\s*$/i);
    var letra = mL ? mL[1].toUpperCase() : '';
    var protVal = scanNumericAfter_(lineas, i, 5);
    if (protVal) fields.prot = protVal + letra;
  }
  if (linUp.indexOf('LDH') === 0) fields.ldh = scanNumericSkipLetterFlag_(lineas, i, 8);
  if (linUp.indexOf('ALBUMINA') === 0) fields.alb = scanNumericSkipLetterFlag_(lineas, i, 8);
  if (linUp.indexOf('TRIGLICER') === 0) fields.tgl = scanNumericSkipLetterFlag_(lineas, i, 8);
  if (linUp.indexOf('AMILASA') === 0) fields.amil = scanNumericSkipLetterFlag_(lineas, i, 8);
}

function scanRecuentoField_(fields, lineas, i, linUp) {
  if (linUp.indexOf('RECUENTO') !== 0 || linUp.indexOf('LEUCOCITOS') !== -1) return;
  var bits = [];
  for (var j = i + 1; j < Math.min(i + 5, lineas.length); j++) {
    var c = lineas[j].replace(/\*/g, '').trim();
    if (!c) continue;
    if (/^LEUCOCITOS/i.test(c)) break;
    if (/^\d+[.,]?\d*$/.test(c) || /^[A-Z]$/i.test(c)) bits.push(c.toUpperCase());
    if (bits.length >= 2) break;
  }
  if (bits.length) fields.rec = bits.join(' ');
}

function scanLeucocitosField_(fields, lineas, i, linUp, normalizarRecuentoCelular) {
  if (!/^LEUCOCITOS/i.test(linUp)) return;
  for (var k = i - 1; k >= Math.max(0, i - 6); k--) {
    var prev = lineas[k].replace(/\*/g, '').trim();
    if (/^\d+[.,]?\d*$/.test(prev)) {
      fields.leu = normalizarRecuentoCelular(prev);
      return;
    }
  }
  for (var m = i + 1; m < Math.min(i + 8, lineas.length); m++) {
    var next = lineas[m].replace(/\*/g, '').trim();
    if (/^\d+[.,]?\d*$/.test(next)) {
      fields.leu = normalizarRecuentoCelular(next);
      return;
    }
  }
}

function scanRecuentoAndLeucocitos_(fields, lineas, i, linUp, normalizarRecuentoCelular) {
  scanRecuentoField_(fields, lineas, i, linUp);
  scanLeucocitosField_(fields, lineas, i, linUp, normalizarRecuentoCelular);
}

function scanCitoDiffCounts_(fields, lineas, i, linUp) {
  if (linUp.indexOf('POLIMORFONUCLEARES') === 0) {
    var ptxt = nextMeaningfulLine_(lineas, i, 5);
    if (ptxt) fields.pmn = ptxt.toUpperCase();
  }
  if (linUp.indexOf('LINFOCITOS') === 0) {
    var ltxt = nextMeaningfulLine_(lineas, i, 5);
    if (ltxt && ltxt !== '%' && ltxt !== '---') fields.linf = ltxt.replace(',', '.');
  }
  if (linUp.indexOf('ERITROCITOS') === 0) {
    var etxt = nextMeaningfulLine_(lineas, i, 5);
    if (etxt) fields.eri = etxt.toUpperCase();
  }
  if (linUp.indexOf('GRAM') === 0) {
    var g = nextMeaningfulLine_(lineas, i, 5);
    if (g) fields.gram = g.toUpperCase();
  }
  if (linUp.indexOf('COMENTARIO') === 0) {
    var cx = nextMeaningfulLine_(lineas, i, 4);
    if (cx && !/^\*+$/.test(cx)) fields.com = cx.toUpperCase();
  }
}

function scanCitoMicroscopy_(fields, lineas, i, linUp, normalizarRecuentoCelular) {
  if (linUp.indexOf('ASPECTO') === 0) {
    var a = nextMeaningfulLine_(lineas, i, 5);
    if (a && !/^:$/.test(a)) fields.aspecto = a.toUpperCase();
  }
  scanRecuentoAndLeucocitos_(fields, lineas, i, linUp, normalizarRecuentoCelular);
  scanCitoDiffCounts_(fields, lineas, i, linUp);
}

/**
 * @param {object} fields
 * @param {string[]} lineas
 * @param {number} i
 * @param {string} lin
 * @param {string} linUp
 * @param {(v: string) => string} normalizarRecuentoCelular
 */
export function scanCitoquimicoLine_(fields, lineas, i, lin, linUp, normalizarRecuentoCelular) {
  scanCitoFluidType_(fields, lineas, i, lin);
  scanCitoChemistry_(fields, lineas, i, lin, linUp);
  scanCitoMicroscopy_(fields, lineas, i, linUp, normalizarRecuentoCelular);
}

/** @param {object} fields @returns {boolean} */
export function citoquimicoFieldsEmpty_(fields) {
  return !Object.values(fields).some(Boolean);
}

/** @param {object} fields @param {object} ctx @returns {string[]} */
export function buildCitoquimicoParts_(fields, ctx) {
  var p = ['Liq:'];
  var pairs = [
    ['fluid', 'Tipo', (v) => v],
    ['dens', 'Dens', (v) => v],
    ['pH', 'pH', (v) => v],
    ['glu', 'Glu', (v) => v],
    ['prot', 'Prot', (v) => ctx.fmtProteinaFluido(v)],
    ['alb', 'Alb', (v) => v],
    ['tgl', 'TGL', (v) => v],
    ['amil', 'Amil', (v) => v],
    ['ldh', 'LDH', (v) => v],
    ['aspecto', 'Asp', (v) => v],
    ['rec', 'Rec', (v) => v],
    ['leu', 'Leu', (v) => v],
    ['pmn', 'PMN', (v) => v],
    ['linf', 'Linf', (v) => v + (/%/.test(v) ? '' : '%')],
    ['eri', 'Eri', (v) => v],
    ['gram', 'Gram', (v) => v],
    ['com', 'Obs', (v) => v],
  ];
  for (var n = 0; n < pairs.length; n++) {
    var key = pairs[n][0];
    var label = pairs[n][1];
    var fmt = pairs[n][2];
    var raw = fields[key];
    if (!raw || (key === 'pmn' && raw === '---') || (key === 'com' && raw === fields.fluid)) continue;
    p.push(label, fmt(raw));
  }
  if (ctx.gasaVal != null) p.push('GASA', String(ctx.gasaVal));
  return p;
}
