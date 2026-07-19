import {
  appendHcPreviewSection,
  appendEventosPreviewSection,
  appendLabsPreviewSection,
} from './format-drive-import-preview-sections.mjs';

/**
 * @param {import('./parse-drive-document.mjs').parseDriveDocument extends (...args: any) => infer R ? R : never} parsed
 * @param {{
 *   applyMode?: 'fill' | 'replace' | 'eventos',
 *   existingEventualidades?: Array<{ at?: string, text?: string }>,
 * }} [opts]
 * @returns {string}
 */
export function formatDriveImportPreview(parsed, opts) {
  opts = opts || {};
  const mode = opts.applyMode || 'fill';
  const lines = [];

  lines.push('Vista previa de importación');
  lines.push('');

  if (parsed.header && (parsed.header.nombre || parsed.header.registro)) {
    lines.push('Paciente en documento');
    const bits = [];
    if (parsed.header.nombre) bits.push(parsed.header.nombre);
    if (parsed.header.registro) bits.push('Reg. ' + parsed.header.registro);
    if (parsed.header.edad) bits.push(parsed.header.edad);
    if (parsed.header.cama) bits.push('Cama ' + parsed.header.cama);
    if (parsed.header.sexo) bits.push(parsed.header.sexo);
    lines.push('  ' + bits.join(' · '));
    lines.push('');
  }

  appendHcPreviewSection(parsed, mode, lines);
  appendEventosPreviewSection(parsed, opts.existingEventualidades || [], lines);
  appendLabsPreviewSection(parsed, lines);

  if (parsed.warnings && parsed.warnings.length) {
    lines.push('Advertencias');
    parsed.warnings.forEach(function (w) {
      lines.push('  • ' + w);
    });
  }

  return lines.join('\n');
}
