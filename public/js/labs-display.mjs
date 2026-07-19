/**
 * Lab result HTML display helpers (extracted from labs.js for boot-graph slimming).
 */

function normalizeGasometryInterpretationLine_(line) {
  var s = String(line == null ? '' : line);
  return /^Interpretación gasometría:/i.test(s.trim()) ? s.toUpperCase() : s;
}

export function escTxt(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderToken(tok) {
  if (!tok) return tok;
  if (tok.endsWith('*')) {
    var inner = escTxt(tok.slice(0, -1));
    return (
      '<strong class="lab-value-altered" title="Fuera de rango de referencia">' +
      inner +
      '</strong><span class="lab-value-star" aria-hidden="true">*</span>'
    );
  }
  return escTxt(tok);
}

function formatLabSectionLabel(label, lineIndex) {
  var t = String(label || '').trim().replace(/:$/, '');
  if (/^Coag\.?$/i.test(t)) return 'COAG';
  if (lineIndex === 0) return t;
  return t;
}

function isLabSectionLabel(label, lineIndex) {
  var t = String(label || '').trim().replace(/:$/, '');
  if (/^Coag\.?$/i.test(t) || /^COAG$/i.test(t)) return true;
  if (lineIndex !== 0) return false;
  return /^(BH|QS|ESC|PFHs|GASES|PIE|LCR|EGO|CUANTORINA|PltCit|FROTIS|SEROL|HECES|COAG|LIPASA|TROP)$/i.test(t);
}

export function isLabSectionHeaderHtml(html) {
  return /<span class="section-lbl">/.test(String(html || ''));
}

export function renderEntry(text) {
  text = normalizeGasometryInterpretationLine_(text);
  return text.split('\n').map(function (line, li) {
    var tabIdx = line.indexOf('\t');
    if (tabIdx >= 0) {
      var label = line.substring(0, tabIdx);
      var rest = line.substring(tabIdx + 1);
      var lh = isLabSectionLabel(label, li)
        ? '<span class="section-lbl">' + escTxt(formatLabSectionLabel(label, li)) + '</span>'
        : escTxt(label);
      var rh = rest
        .split(' ')
        .map(function (tok) {
          if (!tok) return tok;
          if (tok === '-') return '<span class="text-gray-500">-</span>';
          return renderToken(tok);
        })
        .join(' ');
      return lh + '\t' + rh;
    }
    return line
      .split(' ')
      .map(function (tok, ti) {
        if (!tok) return tok;
        if (li === 0 && ti === 0) return '<span class="section-lbl">' + escTxt(tok) + '</span>';
        if (tok === '-') return '<span class="text-gray-500">-</span>';
        return renderToken(tok);
      })
      .join(' ');
  });
}
