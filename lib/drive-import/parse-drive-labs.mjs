import { parseDateLine, resolveYear, inferDocumentYearFromText } from './eventualidad-dates.mjs';
import { normalizeDrivePaste } from './normalize.mjs';

/** @typedef {{ fecha: string, hora?: string, resLabs: string[], sourceText?: string, bhExtras?: Record<string, string> }} DriveLabSet */

const PANEL_PREFIX_RE =
  /^(BH|QS|ES|ESC|PFH|PFHs|GV|GASES|COAG|PIE|LCR|EGO|CUANTORINA|PltCit|FROTIS)[\s\t]+/i;

/** @type {Array<{ panel: string, re: RegExp }>} */
const INFER_PANEL_RULES = [
  { panel: 'BH', re: /^(?:Hb|Hto|VCM|HCM|Leu|Neu|Eos|Plt|RBC|Ret)\b/i },
  { panel: 'QS', re: /^(?:Glu|Cr|BUN|eTFG|AU|TGL|COL|PCR)\b/i },
  { panel: 'ESC', re: /^(?:Na|Cl|K|Ca|F|Mg)\b/i },
  { panel: 'PFHs', re: /^(?:Alb|AST|ALT|FA|BT|BD|BI|LDH|Amil)\b/i },
  { panel: 'GASES', re: /^(?:pH|pCO2|pO2|Lactato|Bica|HCO3|BE)\b/i },
  { panel: 'COAG', re: /^(?:TP|TTP|INR|Fib|DD)\b/i },
];

const LAB_SECTION_STOP_RE =
  /^(EVENTUALIDADES|ESTADO ACTUAL|HISTORIA\s+CL[IÍ]NICA|PENDIENTES|DX\s*:|FICHA\s+DE\s+IDENTIFICACI[ÓO]N|MOTIVO\s+DE\s+CONSULTA)\b/i;

/**
 * @param {string} token
 * @returns {string}
 */
export function normalizeDriveLabPanel(token) {
  const u = String(token || '').trim().toUpperCase();
  if (u === 'ES' || u === 'ESC') return 'ESC';
  if (u === 'PFH' || u === 'PFHS') return 'PFHs';
  if (u === 'GV' || u === 'GASES' || u === 'GASE') return 'GASES';
  if (u === 'BH') return 'BH';
  if (u === 'QS') return 'QS';
  return String(token || '').trim();
}

/**
 * @param {string} line
 * @returns {boolean}
 */
export function isDriveLabDateLine(line) {
  return !!parseDateLine(line);
}

/**
 * @param {string} line
 * @returns {boolean}
 */
export function isDriveLabPanelLine(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  if (isDriveLabDateLine(t)) return false;
  if (PANEL_PREFIX_RE.test(t)) return true;
  return INFER_PANEL_RULES.some((r) => r.re.test(t));
}

/**
 * @param {string} content
 * @returns {string}
 */
function collapseLabWhitespace(content) {
  return String(content || '')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} line
 * @returns {string | null}
 */
export function driveLabPanelLineToResLab(line) {
  const collapsed = collapseLabWhitespace(line);
  if (!collapsed) return null;

  const prefixHit = PANEL_PREFIX_RE.exec(collapsed);
  if (prefixHit) {
    const panel = normalizeDriveLabPanel(prefixHit[1]);
    const rest = collapseLabWhitespace(collapsed.slice(prefixHit[0].length));
    if (!rest) return null;
    return panel + '\t' + rest;
  }

  for (const rule of INFER_PANEL_RULES) {
    if (rule.re.test(collapsed)) {
      return rule.panel + '\t' + collapsed;
    }
  }
  return null;
}

/**
 * @param {{ day: number, month: number, year?: number }} partial
 * @param {number | undefined} documentYear
 * @returns {string}
 */
export function formatDriveLabFecha(partial, documentYear) {
  const y = resolveYear(partial, { documentYear, referenceYear: documentYear });
  const dd = String(partial.day).padStart(2, '0');
  const mm = String(partial.month).padStart(2, '0');
  return dd + '/' + mm + '/' + y;
}

/**
 * @param {string} body
 * @param {{ documentYear?: number }} [opts]
 * @returns {{ sets: DriveLabSet[], warnings: string[] }}
 */
export function parseDriveLaboratorios(body, opts) {
  opts = opts || {};
  const text = normalizeDrivePaste(body);
  /** @type {string[]} */
  const warnings = [];
  if (!text.trim()) return { sets: [], warnings };

  const documentYear =
    opts.documentYear != null ? opts.documentYear : inferDocumentYearFromText(text);

  /** @type {DriveLabSet[]} */
  const sets = [];
  /** @type {string[]} */
  let currentDate = '';
  /** @type {string[]} */
  let currentLines = [];
  /** @type {string[]} */
  let currentSource = [];

  function flushDay() {
    const resLabs = [];
    currentLines.forEach(function (ln) {
      const chunk = driveLabPanelLineToResLab(ln);
      if (chunk) resLabs.push(chunk);
    });
    if (!resLabs.length) {
      currentLines = [];
      currentSource = [];
      return;
    }
    if (!currentDate) {
      warnings.push('Bloque de laboratorio sin fecha reconocible; se omitió.');
      currentLines = [];
      currentSource = [];
      return;
    }
    sets.push({
      fecha: currentDate,
      hora: '',
      resLabs: resLabs,
      sourceText: currentSource.join('\n').trim(),
    });
    currentLines = [];
    currentSource = [];
  }

  text.split('\n').forEach(function (rawLine) {
    const line = rawLine.trim();
    if (!line) return;
    if (LAB_SECTION_STOP_RE.test(line)) return;

    const dateParts = parseDateLine(line);
    if (dateParts) {
      flushDay();
      currentDate = formatDriveLabFecha(dateParts, documentYear);
      currentSource = [line];
      return;
    }

    if (!isDriveLabPanelLine(line)) return;
    if (!currentDate) {
      warnings.push('Línea de laboratorio antes de la primera fecha: ' + line.slice(0, 48));
      return;
    }
    currentLines.push(line);
    currentSource.push(line);
  });

  flushDay();

  return { sets: sets, warnings: warnings };
}

/**
 * @param {string} rawText
 * @param {string} [sectionBody]
 * @returns {string}
 */
export function extractLaboratoriosBody(rawText, sectionBody) {
  const fromSection = String(sectionBody || '').trim();
  if (fromSection) return fromSection;

  const text = normalizeDrivePaste(rawText);
  const m = /\nLABORATORIOS(?:\s+DE\s+INGRESO)?\s*\n/i.exec('\n' + text);
  if (!m) return '';

  const after = text.slice(m.index + m[0].length - 1);
  const lines = after.split('\n');
  /** @type {string[]} */
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (LAB_SECTION_STOP_RE.test(t)) break;
    out.push(line);
  }
  return out.join('\n').trim();
}
