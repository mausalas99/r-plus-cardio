/** Códigos de panel de laboratorio reconocidos en censo PDF/HTML. */
export const CENSO_LAB_PANEL_CODES =
  'BH|QS|ELECTROLITOS|PFHs|PFH|GASES|COAG|ORINA|ESC|LIPASA|PROCALCITONINA|HCG|TROP';

const LAB_DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
const LAB_DATE_LEAD_RE = /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+)$/;
const LAB_PANEL_LINE_RE = new RegExp(
  '^(' + CENSO_LAB_PANEL_CODES + ')\\s*(?:[:·]|\\s)',
  'i'
);
const SIGNOS_LABEL_RE = /^[A-Z0-9°]+\s*:/;

/**
 * @param {string} line
 * @returns {string}
 */
export function normalizeCensoPanelLine(line) {
  var s = String(line || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  return s.replace(/^([A-Za-z0-9]+)\s*:\s*/, '$1 · ');
}

/**
 * Parte una línea con varios paneles pegados en filas (BH … QS …).
 * @param {string} text
 * @returns {string[]}
 */
export function splitCensoLabPanelsLine(text) {
  var s = String(text || '').trim();
  if (!s) return [];
  var splitRe = new RegExp(
    '(?=\\b(?:' + CENSO_LAB_PANEL_CODES + ')\\s*(?:[:·]|\\s))',
    'gi'
  );
  var parts = s.split(splitRe).map(function (p) {
    return normalizeCensoPanelLine(p);
  });
  parts = parts.filter(Boolean);
  return parts.length ? parts : [normalizeCensoPanelLine(s)];
}

/**
 * Una fecha por línea; un panel por línea cuando venían concatenados.
 * @param {string[]} lines
 * @returns {string[]}
 */
export function reflowLabsForCensoDisplay(lines) {
  var out = [];
  (lines || []).forEach(function (line) {
    var s = String(line || '').trim();
    if (!s) return;
    var lead = s.match(LAB_DATE_LEAD_RE);
    if (lead) {
      out.push(lead[1]);
      s = lead[2];
    } else if (LAB_DATE_RE.test(s)) {
      out.push(s);
      return;
    }
    splitCensoLabPanelsLine(s).forEach(function (row) {
      out.push(row);
    });
  });
  return out;
}

/**
 * Rol visual de una línea en la tabla del censo.
 * @param {string} line
 * @param {string} colKey
 * @param {number} [lineIndex]
 * @returns {'default' | 'muted' | 'emphasis' | 'lab-date' | 'lab-panel' | 'label-led'}
 */
export function classifyCensoTableLine(line, colKey, lineIndex) {
  var s = String(line || '').trim();
  if (!s || s === '—') return 'default';

  if (colKey === 'paciente') {
    return lineIndex === 0 ? 'emphasis' : 'muted';
  }
  if (colKey === 'labs') {
    if (LAB_DATE_RE.test(s)) return 'lab-date';
    if (LAB_PANEL_LINE_RE.test(s)) return 'lab-panel';
    return 'default';
  }
  if ((colKey === 'signos' || colKey === 'io') && SIGNOS_LABEL_RE.test(s)) {
    return 'label-led';
  }
  if (colKey === 'dx') return 'emphasis';
  return 'default';
}
