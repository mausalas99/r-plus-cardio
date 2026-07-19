/** EGO parse helpers — extracted from labs-ego-parse.mjs for complexity budget. */

var EGO_SKIP_SEARCH =
  /^(N\/A|EstudioResultado|ESTUDIO|SEDIMENTO|QUIMICO|FISICO|MICROSCOPICO|URIANALISIS|EXAMEN GENERAL|OBSERVACIONES)/i;
var EGO_SKIP_LABEL =
  /^(N\/A|Estudio|Resultado|Unidades|Valor de Referencia|VALOR DE REF)/i;

var EGO_ABBREV = {
  NEGATIVO: 'NEG',
  NEGATIVE: 'NEG',
  POSITIVO: 'POS',
  POSITIVE: 'POS',
  AUSENTES: 'AUS',
  AUSENTE: 'AUS',
  ESCASAS: 'ESC',
  ESCASO: 'ESC',
  MODERADAS: 'MOD',
  MODERADO: 'MOD',
  ABUNDANTES: 'ABD',
  ABUNDANTE: 'ABD',
  AMARILLO: 'AMAR',
  TURBIO: 'TURB',
  CLARO: 'CLARO',
};

var EGO_POS_NEG_TYPES = ['PROT', 'GLU', 'CET', 'BILI', 'NITR', 'ESTLEU'];
var EGO_AUS_TYPES = ['BACT', 'CELEP', 'CLING', 'CLINH', 'LEVAD', 'MOCO'];

export function valorTrasEtiqueta(lineas, etiquetas) {
  for (var e = 0; e < etiquetas.length; e++) {
    var lbl = etiquetas[e].toUpperCase();
    for (var i = 0; i < lineas.length; i++) {
      if (lineas[i].toUpperCase() !== lbl) continue;
      for (var j = i + 1; j < Math.min(i + 10, lineas.length); j++) {
        var l = lineas[j].trim();
        if (!l || /^[ABHL]$/.test(l) || EGO_SKIP_LABEL.test(l) || /^[-–:/.]+$/.test(l)) continue;
        var mNum = l.match(/^(-?\d+[.,]?\d*)/);
        if (mNum) return mNum[1].replace(',', '.');
      }
    }
  }
  return null;
}

function esUnidadEGO_(l) {
  return (
    /^(Hem\/uL|Leucocitos\/uL|E\.U\.\/dL|mOsm\/L|mg\/dL|mmol\/L|g\/dL|\/CAMPO|K\/uL|fL|pg|uL|U\/L|SEG\.?)$/i.test(l) ||
    /^[a-zA-Z]+\/[a-zA-Z]+$/.test(l)
  );
}

function tryParseEgoValue(l) {
  var mApr = l.match(/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)/i);
  if (mApr) return mApr[1];
  if (esUnidadEGO_(l)) return null;
  if (/^\d[\d.,]*\s+[-–]\s+\d[\d.,]*$/.test(l)) return null;
  if (/^\d+[-–]\d+\//.test(l)) return null;
  if (/^\d+[-–]\d+$/.test(l)) return l;
  var mNum = l.match(/^(-?\d+[.,]?\d*)/);
  if (mNum) return mNum[1].replace(',', '.');
  if (l.length <= 30 && !/\d{4,}/.test(l) && !/VALOR DE REF/i.test(l)) return l.toUpperCase();
  return null;
}

export function buscarValorEGO_(lineas, nombres) {
  for (var n = 0; n < nombres.length; n++) {
    for (var i = 0; i < lineas.length; i++) {
      if (lineas[i].toUpperCase() !== nombres[n].toUpperCase()) continue;
      for (var j = i + 1; j < Math.min(i + 8, lineas.length); j++) {
        var l = lineas[j].trim();
        if (!l || /^[ABHL]$/.test(l) || /^[:\-/.\s]+$/.test(l) || EGO_SKIP_SEARCH.test(l)) continue;
        var parsed = tryParseEgoValue(l);
        if (parsed != null) return parsed;
      }
    }
  }
  return '---';
}

export function abreviarEGO_(val) {
  if (!val || val === '---') return '---';
  var v = val.toUpperCase().trim();
  return EGO_ABBREV[v] || v;
}

function marcarEGOPosNeg_(ab, tipo) {
  if (EGO_POS_NEG_TYPES.indexOf(tipo) !== -1) return ab !== 'NEG' && ab !== 'AUS' ? ab + '*' : ab;
  if (EGO_AUS_TYPES.indexOf(tipo) !== -1) return ab !== 'AUS' ? ab + '*' : ab;
  return ab;
}

function marcarEGOThreshold_(ab, val, threshold) {
  var mR = val.match(/^(\d+)[-–](\d+)$/);
  if (mR) return parseInt(mR[1], 10) > threshold ? ab + '*' : ab;
  var vC = parseFloat(val);
  return !isNaN(vC) && vC > threshold ? ab + '*' : ab;
}

function marcarEGORange_(ab, val, low, high) {
  var v = parseFloat(val);
  return !isNaN(v) && (v < low || v > high) ? ab + '*' : ab;
}

export function marcarEGO_(val, tipo) {
  if (!val || val === '---') return '---';
  var ab = abreviarEGO_(val);
  if (tipo === 'SANG') {
    var vSang = parseFloat(val);
    if (!isNaN(vSang)) return vSang > 0 ? val + '*' : 'NEG';
    return ab !== 'NEG' && ab !== 'AUS' ? ab + '*' : ab;
  }
  if (tipo === 'UROBIL') {
    var vU = parseFloat(val);
    return !isNaN(vU) && vU > 1 ? ab + '*' : ab;
  }
  if (tipo === 'PH') return marcarEGORange_(ab, val, 5.5, 6.5);
  if (tipo === 'DENS') return marcarEGORange_(ab, val, 1.005, 1.025);
  if (tipo === 'LEU') return marcarEGOThreshold_(ab, val, 5);
  if (tipo === 'ERI') return marcarEGOThreshold_(ab, val, 2);
  return marcarEGOPosNeg_(ab, tipo);
}

var EGO_FIELD_DEFS = [
  { section: 'fisico', key: 'color', prefix: '', tipo: 'COLOR' },
  { section: 'fisico', key: 'aspecto', prefix: '', tipo: 'ASPECTO' },
  { section: 'fisico', key: 'ph', prefix: 'pH ', tipo: 'PH' },
  { section: 'fisico', key: 'dens', prefix: 'D ', tipo: 'DENS' },
  { section: 'quimico', key: 'prot', prefix: 'Prot ', tipo: 'PROT' },
  { section: 'quimico', key: 'glu', prefix: 'Glu ', tipo: 'GLU' },
  { section: 'quimico', key: 'cet', prefix: 'Cet ', tipo: 'CET' },
  { section: 'quimico', key: 'bilis', prefix: 'Bili ', tipo: 'BILI' },
  { section: 'quimico', key: 'sangre', prefix: 'Sang ', tipo: 'SANG' },
  { section: 'quimico', key: 'nitr', prefix: 'Nitr ', tipo: 'NITR' },
  { section: 'quimico', key: 'urobil', prefix: 'Urobil ', tipo: 'UROBIL' },
  { section: 'quimico', key: 'estLeu', prefix: 'EstLeu ', tipo: 'ESTLEU' },
  { section: 'sedimento', key: 'leu', prefix: 'Leu ', tipo: 'LEU' },
  { section: 'sedimento', key: 'eri', prefix: 'Eri ', tipo: 'ERI' },
  { section: 'sedimento', key: 'bact', prefix: 'Bact ', tipo: 'BACT', skipAus: true },
  { section: 'sedimento', key: 'celEpit', prefix: 'CelEp ', tipo: 'CELEP', skipAus: true },
  { section: 'sedimento', key: 'cilinG', prefix: 'CilinG ', tipo: 'CLING', skipAus: true },
  { section: 'sedimento', key: 'cilinH', prefix: 'CilinH ', tipo: 'CLINH', skipAus: true },
  { section: 'sedimento', key: 'levad', prefix: 'Levad ', tipo: 'LEVAD', skipAus: true },
  { section: 'sedimento', key: 'moco', prefix: 'Moco ', tipo: 'MOCO', skipAus: true },
];

var EGO_FIELD_LABELS = {
  color: ['COLOR'],
  aspecto: ['ASPECTO'],
  ph: ['PH'],
  dens: ['DENSIDAD', 'GRAVEDAD ESPECIFICA'],
  prot: ['PROTEINAS', 'PROTEINURIA'],
  glu: ['GLUCOSA'],
  cet: ['CETONAS', 'CUERPOS CETONICOS'],
  bilis: ['BILIRRUBINAS', 'BILIRRUBINA'],
  sangre: ['SANGRE'],
  nitr: ['NITRITOS'],
  urobil: ['UROBILINOGENO', 'UROBILINÓGENO'],
  estLeu: ['ESTERASA LEUCOCITARIA'],
  leu: ['LEUCOCITOS'],
  eri: ['ERITROCITOS', 'HEMATIES'],
  bact: ['BACTERIAS'],
  celEpit: ['CELULAS EPITELIALES'],
  cilinG: ['CILINDROS GRANOLOSOS'],
  cilinH: ['CILINDROS HIALINOS'],
  levad: ['LEVADURAS'],
  moco: ['MOCO'],
};

export function collectEgoFieldValues_(lineas) {
  var out = {};
  Object.keys(EGO_FIELD_LABELS).forEach(function (key) {
    out[key] = buscarValorEGO_(lineas, EGO_FIELD_LABELS[key]);
  });
  return out;
}

export function buildEgoSections_(f, qOrina) {
  var sections = { fisico: [], quimico: [], sedimento: [] };
  EGO_FIELD_DEFS.forEach(function (def) {
    var val = f[def.key];
    if (val === '---') return;
    if (def.skipAus && abreviarEGO_(val) === 'AUS') return;
    sections[def.section].push(def.prefix + marcarEGO_(val, def.tipo));
  });
  if (qOrina.na) sections.quimico.push('NaU ' + qOrina.na);
  if (qOrina.k) sections.quimico.push('KU ' + qOrina.k);
  if (qOrina.cl) sections.quimico.push('ClU ' + qOrina.cl);
  if (qOrina.cr) sections.quimico.push('CrU ' + qOrina.cr);
  return sections;
}
