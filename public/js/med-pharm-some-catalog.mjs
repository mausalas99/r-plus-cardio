/**
 * Catálogo de categorías SOME para perfil farmacoterapéutico (filtros + clasificación por nombre).
 * CCN bajo: listas de tokens, un solo clasificador, overlay opcional desde rpc-medCatalog.
 */

const MAX_TOKENS_PER_CAT = 400;
const MAX_TOKEN_LEN = 64;

/** Orden fijo del filtro (lista SOME del hospital). */
export const SOME_PHARM_FILTER_ORDER = [
  'AGONISTA ALFA/BETA',
  'ANALGÉSICO',
  'ANALGÉSICO ANTIPIRÉTICO/ANTIINFLAMATORIC',
  'ANESTÉSICO',
  'ANTIARRÍTMICO',
  'ANTIASMÁTICO',
  'ANTIBIÓTICO',
  'ANTICOAGULANTE',
  'ANTICONVULSIVO',
  'ANTIDIABÉTICO',
  'ANTIINFLAMATORIO ESTEROIDEO',
  'ANTILIPÉMICO',
  'ANTIULCEROSO',
  'BRONCODILATADOR',
  'CORTICOSTEROIDE',
  'DIURÉTICO',
  'LAXANTE',
  'RELAJANTE MUSCULAR PERIFÉRICO',
  'SEDANTE',
  'SUEROS',
  'SUPLEMENTO',
  'SUPLEMENTO ELECTROLÍTICO',
  'OTROS',
];

const BUILTIN_TOKENS = {
  'AGONISTA ALFA/BETA': [
    'NORADRENALINA',
    'NOREPINEFRINA',
    'EPINEFRINA',
    'DOPAMINA',
    'DOBUTAMINA',
    'VASOPRESINA',
    'FENILEFRINA',
    'FENILEFRIN',
  ],
  'ANALGÉSICO': ['METAMIZOL', 'MORFINA', 'TRAMADOL', 'FENTANILO', 'REMIFENTANILO'],
  'ANALGÉSICO ANTIPIRÉTICO/ANTIINFLAMATORIC': ['PARACETAMOL', 'KETOROLAC', 'IBUPROFENO', 'DICLOFENACO'],
  ANESTÉSICO: ['PROPOFOL', 'KETAMINA', 'LIDOCAINA', 'BUPIVACAINA'],
  ANTIARRÍTMICO: ['AMIODARONA', 'LIDOCAINA', 'METOPROLOL'],
  ANTIASMÁTICO: ['SALBUTAMOL', 'IPRATROPIO', 'TIOTROPIO', 'MONTELUKAST'],
  'ANTIBIÓTICO': [
    'ERTAPENEM',
    'CEFALOTINA',
    'CEFTRIAX',
    'CEFEPIME',
    'MEROPENEM',
    'VANCOMICINA',
    'PIPERACILINA',
    'TAZOBACTAM',
    'METRONIDAZOL',
    'LINEZOLID',
    'AZITROMICINA',
    'LEVOFLOX',
    'CIPROFLOX',
    'AMIKACINA',
    'GENTAMICINA',
    'AMPICILINA',
    'FLUCONAZOL',
  ],
  ANTICOAGULANTE: ['ENOXAPARINA', 'HEPARINA', 'APIXABAN', 'RIVAROXABAN', 'WARFARINA'],
  ANTICONVULSIVO: ['LEVETIRACETAM', 'FENITOINA', 'VALPROATO', 'CARBAMAZEPINA'],
  'ANTIDIABÉTICO': ['INSULINA', 'METFORMINA', 'GLARGINA'],
  'ANTIINFLAMATORIO ESTEROIDEO': ['METILPREDNISOLONA', 'HIDROCORTISONA'],
  'ANTILIPÉMICO': ['ATORVASTATINA', 'ROSUVASTATINA', 'SINVASTATINA'],
  ANTIULCEROSO: ['OMEPRAZOL', 'PANTOPRAZOL', 'ESOMEPRAZOL', 'RANITIDINA'],
  BRONCODILATADOR: ['SALBUTAMOL', 'IPRATROPIO', 'TIOTROPIO', 'TERBUTALINA'],
  CORTICOSTEROIDE: ['BUDESONIDA', 'DEXAMETASONA', 'HIDROCORTISONA', 'METILPREDNISOLONA'],
  DIURÉTICO: ['FUROSEMIDA', 'ESPIRONOLACTONA', 'MANITOL', 'TORASEMIDA'],
  LAXANTE: ['LACTULOSA', 'POLIETILENGLICOL', 'BISACODILO', 'SENOSIDO'],
  'RELAJANTE MUSCULAR PERIFÉRICO': ['CISATRACURIO', 'ROCURONIO', 'VECURONIO', 'PANCURONIO'],
  SEDANTE: ['DEXMEDETOMIDINA', 'PROPOFOL', 'MIDAZOLAM'],
  SUEROS: [
    'CLORURO DE SODIO',
    'SOLUCION SALINA',
    'DEXTROSA',
    'LACTATO',
    'RINGER',
    'CLORURO DE POTASIO',
    'SULFATO DE MAGNESIO',
    'SOLUCION GLUCOSADA',
  ],
  SUPLEMENTO: ['MULTIVITAMINICO', 'VITAMINA', 'ZINC', 'HIERRO'],
  'SUPLEMENTO ELECTROLÍTICO': ['POTASIO', 'MAGNESIO', 'FOSFORO', 'CALCIO GLUCONATO'],
};

let _overlayTokens = null;

function normName(nombreRaw) {
  return String(nombreRaw || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeTokenList(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = Object.create(null);
  for (let i = 0; i < arr.length && out.length < MAX_TOKENS_PER_CAT; i += 1) {
    let t = String(arr[i] || '').trim();
    if (t.length > MAX_TOKEN_LEN) t = t.slice(0, MAX_TOKEN_LEN);
    if (!t) continue;
    const k = t.toUpperCase();
    if (seen[k]) continue;
    seen[k] = 1;
    out.push(t);
  }
  return out;
}

function sanitizeSomePharmCatalog(raw) {
  const tokens = Object.create(null);
  if (!raw || typeof raw !== 'object') return { tokens };
  const src = raw.tokens && typeof raw.tokens === 'object' ? raw.tokens : raw;
  SOME_PHARM_FILTER_ORDER.forEach(function (cat) {
    if (cat === 'OTROS') return;
    if (Array.isArray(src[cat])) tokens[cat] = sanitizeTokenList(src[cat]);
  });
  return { tokens };
}

function tokensForCategory(cat) {
  const custom = _overlayTokens && _overlayTokens[cat];
  if (custom && custom.length) return custom;
  return BUILTIN_TOKENS[cat] || [];
}

function tokensMatch(nNorm, tokens) {
  if (!tokens.length) return false;
  const parts = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const x = normName(tokens[i]);
    if (x) parts.push(escapeRegExp(x));
  }
  if (!parts.length) return false;
  return new RegExp('\\b(' + parts.join('|') + ')\\b').test(nNorm);
}

/**
 * @param {{ somePharm?: { tokens?: Record<string, string[]> } } | null} catalogFromStorage
 */
export function applySomePharmCatalogOverlay(catalogFromStorage) {
  const block =
    catalogFromStorage && catalogFromStorage.somePharm
      ? catalogFromStorage.somePharm
      : catalogFromStorage;
  _overlayTokens = sanitizeSomePharmCatalog(block).tokens;
}

export function getSomePharmCatalogSnapshot() {
  const tokens = Object.create(null);
  SOME_PHARM_FILTER_ORDER.forEach(function (cat) {
    if (cat === 'OTROS') return;
    tokens[cat] = tokensForCategory(cat).slice();
  });
  return { tokens };
}

export function listSomePharmFilterLabels() {
  return ['TODOS'].concat(SOME_PHARM_FILTER_ORDER);
}

export function isSomePharmCategoryLabel(cat) {
  return SOME_PHARM_FILTER_ORDER.indexOf(String(cat || '')) >= 0;
}

export function classifySomePharmCategory(nombreRaw) {
  const n = normName(nombreRaw);
  if (!n) return 'OTROS';
  for (let i = 0; i < SOME_PHARM_FILTER_ORDER.length; i += 1) {
    const cat = SOME_PHARM_FILTER_ORDER[i];
    if (cat === 'OTROS') break;
    if (tokensMatch(n, tokensForCategory(cat))) return cat;
  }
  return 'OTROS';
}

/** Categoría efectiva para filtro (override manual > auto). */
export function rowSomePharmCategory(row) {
  if (!row) return 'OTROS';
  if (row.catOverride) return String(row.catOverride);
  if (row.cat) return String(row.cat);
  return classifySomePharmCategory(row.med);
}

export function assignSomePharmCategory(row) {
  if (!row) return row;
  const next = Object.assign({}, row);
  if (!next.catOverride) next.cat = classifySomePharmCategory(next.med);
  return next;
}

export function assignSomePharmCategories(rows) {
  return (rows || []).map(assignSomePharmCategory);
}
