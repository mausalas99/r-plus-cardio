function medTitle(nombreRaw) {
  var s = String(nombreRaw || '').trim();
  if (!s) return '';
  s = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
  var chunk = (s.split(/\s+(?=\d)/)[0] || '').trim();
  return (chunk || s).slice(0, 80).toUpperCase();
}

function formatDia(diaTratamiento) {
  if (diaTratamiento == null || diaTratamiento === '') return '';
  var n = Number(diaTratamiento);
  if (!Number.isFinite(n) || n < 0) return '';
  return 'Día ' + String(Math.floor(n));
}

/**
 * Censo: solo nombre del medicamento y día de tratamiento.
 * @param {{ items?: Array<Record<string, unknown>> }|null|undefined} block
 * @returns {string}
 */
export function formatCensoMedsFromReceta(block) {
  if (!block || !Array.isArray(block.items)) return '';
  var lines = [];
  block.items.forEach(function (it) {
    if (!it || it.suspendido) return;
    var name = medTitle(it.nombreRaw);
    if (!name) return;
    var dia = formatDia(it.diaTratamiento);
    lines.push(dia ? name + ' · ' + dia : name);
  });
  return lines.join('\n');
}
