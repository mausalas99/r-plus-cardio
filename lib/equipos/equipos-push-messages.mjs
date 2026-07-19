/** Spanish push copy for equipos waitlist — shared LAN + cloud. */

import { EQUIPOS_ICON_192 } from './equipos-icon-paths.mjs';
import { EQUIPOS_PWA_LAN_URL } from './equipos-pwa-urls.mjs';

export const DEVICE_LABELS = {
  lumify: 'Lumify',
  ekg: 'EKG',
  ultrasound: 'Ultrasonido',
};

/**
 * @param {'device_available'|'lumify_return'|'malfunction'|'missing_material'|'waitlist_next'|'queue_bypass'} kind
 * @param {object} ctx
 * @param {string} ctx.deviceType
 * @param {number} [ctx.position]
 * @param {boolean} [ctx.isNext]
 * @param {number|null} [ctx.chargePct]
 * @param {string} [ctx.message]
 * @param {string} [ctx.takerName]
 * @param {string} [ctx.takerRotation]
 * @param {string} [ctx.appUrl] PWA start URL for notification click-through
 */
export function buildEquiposPushPayload(kind, ctx) {
  const label = DEVICE_LABELS[ctx.deviceType] || ctx.deviceType;
  const icon = EQUIPOS_ICON_192;
  const badge = EQUIPOS_ICON_192;
  const tag = `equipos-${ctx.deviceType}-${kind}`;
  const appUrl = ctx.appUrl || EQUIPOS_PWA_LAN_URL;
  const data = { deviceType: ctx.deviceType, kind, url: appUrl };

  if (kind === 'lumify_return') {
    const pct = ctx.chargePct != null ? `${ctx.chargePct}%` : '—';
    const title = `${label} libre`;
    const body = ctx.isNext ? `Batería: ${pct}` : `Posición ${ctx.position ?? 2} · Batería: ${pct}`;
    return { title, body, icon, badge, tag, data: { ...data, chargePct: ctx.chargePct } };
  }

  if (kind === 'device_available') {
    const title = ctx.isNext ? `${label} disponible` : `${label} liberado`;
    const body = ctx.isNext
      ? 'Eres el siguiente en la cola. Puedes tomarlo ahora.'
      : `El dispositivo está libre. Tu posición: ${ctx.position ?? '—'}.`;
    return { title, body, icon, badge, tag, data };
  }

  if (kind === 'malfunction') {
    return {
      title: `Falla — ${label}`,
      body: ctx.message
        ? `Reporte en cola: ${ctx.message}`
        : 'Se reportó una falla del dispositivo. Revisa el tablero.',
      icon,
      badge,
      tag,
      data,
    };
  }

  if (kind === 'missing_material') {
    return {
      title: `Material faltante — ${label}`,
      body: ctx.message
        ? `Reporte en cola: ${ctx.message}`
        : 'Falta material en el dispositivo. Revisa el tablero.',
      icon,
      badge,
      tag,
      data,
    };
  }

  if (kind === 'waitlist_next') {
    return {
      title: `Eres el siguiente — ${label}`,
      body: 'Alguien cedió el turno. Te avisaremos cuando el dispositivo esté libre.',
      icon,
      badge,
      tag: `equipos-${ctx.deviceType}-waitlist_next`,
      data,
    };
  }

  if (kind === 'queue_bypass') {
    const who = ctx.takerName
      ? `${ctx.takerName} (${ctx.takerRotation || '—'})`
      : 'Otro equipo';
    return {
      title: `${label} — fuera de turno`,
      body: `${who} tomó el dispositivo sin ser el siguiente en la cola.`,
      icon,
      badge,
      tag: `equipos-${ctx.deviceType}-queue_bypass`,
      data,
    };
  }

  return { title: label, body: 'Actualización de cola.', icon, badge, tag, data };
}
