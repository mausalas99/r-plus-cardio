import { summarizeHcValue } from './summarize-hc-value.mjs';
import { filterNewEventualidades } from './merge-eventualidades.mjs';
import { listHcPatchSectionKeys } from './map-universal-hc.mjs';
import { HC_SECTION_LABELS } from './drive-import-hc-edit.mjs';

/**
 * @param {string} iso
 * @returns {string}
 */
export function formatEvDate(iso) {
  if (!iso) return 'sin fecha';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'sin fecha';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return dd + '/' + mm + '/' + yy;
}

/**
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
export function clipLine(text, max) {
  const t = String(text || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!t) return '(vacía)';
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

/**
 * @param {string[]} resLabs
 * @returns {string}
 */
export function summarizeLabPanels(resLabs) {
  const panels = [];
  (resLabs || []).forEach(function (chunk) {
    const first = String(chunk || '').split('\n')[0].trim();
    const tok = first.split(/\s+/)[0].replace(':', '');
    if (tok && panels.indexOf(tok) === -1) panels.push(tok);
  });
  return panels.length ? panels.join(', ') : 'sin paneles';
}

/**
 * @param {import('./parse-drive-document.mjs').parseDriveDocument extends (...args: any) => infer R ? R : never} parsed
 * @param {'fill' | 'replace' | 'eventos'} mode
 * @param {string[]} lines
 */
export function appendHcPreviewSection(parsed, mode, lines) {
  const hcKeys = listHcPatchSectionKeys(parsed.hcPatch || {});
  lines.push('Historia clínica');
  if (mode === 'eventos') {
    lines.push('  Omitida (modo solo eventualidades)');
  } else if (!hcKeys.length) {
    lines.push('  Sin secciones detectadas en el pegado');
  } else {
    const modeLabel =
      mode === 'replace'
        ? 'Reemplazará secciones presentes en el documento'
        : 'Completará solo campos vacíos en HC';
    lines.push('  ' + modeLabel);
    hcKeys.forEach(function (key) {
      const label = HC_SECTION_LABELS[key] || key;
      lines.push('  • ' + label + ': ' + summarizeHcValue(parsed.hcPatch[key]));
    });
  }
  lines.push('');
}

/**
 * @param {import('./parse-drive-document.mjs').parseDriveDocument extends (...args: any) => infer R ? R : never} parsed
 * @param {Array<{ at?: string, text?: string }>} existingEventualidades
 * @param {string[]} lines
 */
export function appendEventosPreviewSection(parsed, existingEventualidades, lines) {
  const allEv = parsed.eventualidades.entries || [];
  const evFiltered = filterNewEventualidades(existingEventualidades || [], allEv);
  const evNew = evFiltered.toAdd || [];
  const evSkipped = parsed.eventualidades.skippedEstimate ?? evFiltered.skipped ?? 0;

  lines.push('Eventualidades');
  if (!allEv.length) {
    lines.push('  Ninguna detectada');
  } else {
    lines.push(
      '  ' +
        evNew.length +
        ' nueva' +
        (evNew.length === 1 ? '' : 's') +
        (evSkipped ? ' · ' + evSkipped + ' duplicada' + (evSkipped === 1 ? '' : 's') + ' omitida' + (evSkipped === 1 ? '' : 's') : ''),
    );
    const show = evNew.slice(0, 12);
    show.forEach(function (entry, idx) {
      const date = formatEvDate(entry.at);
      const firstLine = clipLine(String(entry.text || '').split('\n')[0], 64);
      lines.push('  ' + (idx + 1) + '. ' + date + ' — ' + firstLine);
    });
    if (evNew.length > show.length) {
      lines.push('  … y ' + (evNew.length - show.length) + ' más');
    }
    if (evSkipped) {
      lines.push('  (' + evSkipped + ' ya en expediente, no se repetirán)');
    }
  }
  lines.push('');
}

/**
 * @param {import('./parse-drive-document.mjs').parseDriveDocument extends (...args: any) => infer R ? R : never} parsed
 * @param {string[]} lines
 */
export function appendLabsPreviewSection(parsed, lines) {
  const labAll = parsed.laboratorios.allSets || parsed.laboratorios.sets || [];
  const labNew = parsed.laboratorios.sets || [];
  const labSkipped = parsed.laboratorios.skippedEstimate || 0;

  lines.push('Laboratorios');
  if (!labAll.length) {
    lines.push('  Ningún bloque con fecha detectado');
  } else {
    lines.push(
      '  ' +
        labNew.length +
        ' fecha' +
        (labNew.length === 1 ? '' : 's') +
        ' a agregar al historial' +
        (labSkipped ? ' · ' + labSkipped + ' duplicada' + (labSkipped === 1 ? '' : 's') + ' omitida' + (labSkipped === 1 ? '' : 's') : ''),
    );
    labNew.slice(0, 10).forEach(function (set, idx) {
      lines.push(
        '  ' +
          (idx + 1) +
          '. ' +
          (set.fecha || '?') +
          ' — ' +
          summarizeLabPanels(set.resLabs),
      );
    });
    if (labNew.length > 10) {
      lines.push('  … y ' + (labNew.length - 10) + ' fechas más');
    }
  }
  lines.push('');
}
