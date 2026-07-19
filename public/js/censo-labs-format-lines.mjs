var PANEL_ORDER = ['BH', 'QS', 'ELECTROLITOS', 'PFHs', 'GASES', 'COAG', 'ORINA', 'OTRO'];

function formatLabPair(key, val) {
  if (val == null || val === '') return '';
  var v = String(val).trim();
  if (!v) return '';
  return key + ' ' + v;
}

function linesFromParsedSection(section, keys) {
  if (!section || typeof section !== 'object') return [];
  var parts = [];
  (keys || Object.keys(section)).forEach(function (k) {
    var line = formatLabPair(k, section[k]);
    if (line) parts.push(line);
  });
  return parts;
}

export function pushLabTextLines(lines, text) {
  String(text || '')
    .split(/\r?\n/)
    .forEach(function (subline) {
      var cleaned = subline.replace(/\t/g, ' ').replace(/  +/g, ' ').trim();
      if (cleaned) lines.push(cleaned);
    });
}

export function linesFromParsedBySectionFull(pb) {
  var blockLines = [];
  var seen = Object.create(null);
  PANEL_ORDER.forEach(function (panelName) {
    seen[panelName] = true;
    var sec = pb[panelName] || pb[panelName.toLowerCase()];
    if (!sec && panelName === 'OTRO') return;
    var panelLines = linesFromParsedSection(sec, null);
    if (panelLines.length) {
      blockLines.push(panelName + ' · ' + panelLines.join('  '));
    }
  });
  Object.keys(pb).forEach(function (panelName) {
    if (seen[panelName] || seen[panelName.toLowerCase()]) return;
    var sec = pb[panelName];
    if (!sec || typeof sec !== 'object' || Array.isArray(sec)) return;
    var panelLines = linesFromParsedSection(sec, null);
    if (panelLines.length) {
      blockLines.push(panelName + ' · ' + panelLines.join('  '));
    }
  });
  return blockLines;
}
