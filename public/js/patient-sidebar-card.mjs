/**
 * Sidebar patient card body — full name + cuarto/cama meta.
 */

/** @param {string} s */
export function escSidebarHtml(s) {
  return escHtml(s);
}

/** @param {{ cuarto?: string, cama?: string }} p */
import { escHtml } from './dom-escape.mjs';

export function formatPatientBedParts(p) {
  const cuarto = String(p?.cuarto || '').trim();
  const cama = String(p?.cama || '').trim();
  return { cuarto, cama };
}

/** @param {{ cuarto?: string, cama?: string }} p */
export function formatPatientBedLabel(p) {
  const { cuarto, cama } = formatPatientBedParts(p);
  if (!cuarto && !cama) return '';
  if (cuarto && cama) return `${cuarto}·${cama}`;
  return cuarto || cama;
}

/** @param {object} p */
export function formatPatientBedMetaHtml(p) {
  const { cuarto, cama } = formatPatientBedParts(p);
  const parts = [];
  if (cuarto) parts.push(`<span>Cto. ${escSidebarHtml(cuarto)}</span>`);
  if (cama) parts.push(`<span>Cama ${escSidebarHtml(cama)}</span>`);
  return parts;
}

/**
 * @param {object} p
 * @param {{ roundRow?: boolean, showServicio?: boolean }|undefined} [opts]
 */
export function renderPatientSidebarBodyHtml(p, opts) {
  opts = opts || {};
  const showServicio = opts.showServicio !== false;
  const nombreRaw = String(p?.nombre || '').trim();
  const nombreDisplay = nombreRaw || 'Sin nombre';
  const registro = String(p?.registro || '').trim();
  const servicio = showServicio ? String(p?.servicio || '').trim() : '';
  const nameTitleAttr = registro
    ? ` title="${escSidebarHtml([registro, servicio].filter(Boolean).join(' · '))}"`
    : servicio
      ? ` title="${escSidebarHtml(servicio)}"`
      : '';

  const metaParts = formatPatientBedMetaHtml(p);
  if (servicio) {
    metaParts.push(`<span class="patient-card-svc">${escSidebarHtml(servicio)}</span>`);
  }

  const metaHtml = metaParts.length
    ? `<div class="p-meta">${metaParts.join('')}</div>`
    : '';

  const bodyClass = opts.roundRow ? 'patient-card-body patient-card-body--round' : 'patient-card-body';

  return (
    `<div class="${bodyClass}">` +
    `<div class="p-name"${nameTitleAttr}>${escSidebarHtml(nombreDisplay)}</div>` +
    metaHtml +
    `</div>`
  );
}
