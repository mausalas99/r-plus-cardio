import { formatAccesoFechaDisplay } from './patient-date-fields.mjs';

export const VIA_ACCESO_LABELS = {
  periferica: 'EV periférica',
  cvc: 'CVC',
  picc: 'PICC',
};

/** @param {unknown} via */
export function viaAccesoLabel(via) {
  var key = String(via || '').trim();
  return VIA_ACCESO_LABELS[key] || key;
}

/** @param {Record<string, unknown>|null|undefined} patient */
export function ensurePatientAccesos(patient) {
  if (!patient) return;
  if (!Array.isArray(patient.accesosList)) {
    patient.accesosList = [];
    if (patient.viaAcceso || patient.accesoFecha) {
      patient.accesosList.push({
        via: String(patient.viaAcceso || '').trim(),
        fecha: String(patient.accesoFecha || '').trim(),
      });
    }
  }
  patient.accesosList = patient.accesosList.map(function (a) {
    return {
      via: String(a && a.via != null ? a.via : '').trim(),
      fecha: String(a && a.fecha != null ? a.fecha : '').trim(),
    };
  });
  if (!patient.accesosList.length) {
    patient.accesosList = [{ via: '', fecha: '' }];
  }
  syncLegacyAccesoFields(patient);
}

/** Mantiene viaAcceso/accesoFecha para manejo de electrolitos y LAN. */
export function syncLegacyAccesoFields(patient) {
  if (!patient) return;
  var list = (patient.accesosList || []).filter(function (a) {
    return String(a && a.via || '').trim();
  });
  var primary = list.find(function (a) {
    return a.via === 'cvc';
  }) || list[0];
  if (primary) {
    patient.viaAcceso = primary.via;
    patient.accesoFecha = primary.fecha || '';
  } else {
    patient.viaAcceso = '';
    patient.accesoFecha = '';
  }
}

/** @param {Record<string, unknown>} patient */
export function formatAccesosForCenso(patient) {
  ensurePatientAccesos(patient);
  return (patient.accesosList || [])
    .map(function (a) {
      var via = viaAccesoLabel(a.via);
      var fecha = formatAccesoFechaDisplay(a.fecha);
      if (!via && !fecha) return '';
      if (via && fecha) return via + ' ' + fecha;
      return via || fecha;
    })
    .filter(Boolean)
    .join('\n');
}

/** @param {Record<string, unknown>} target @param {Record<string, unknown>|undefined} source */
export function mergeAccesosPatientFields(target, source) {
  if (!target || !source) return;
  if (Array.isArray(source.accesosList) && source.accesosList.length) {
    target.accesosList = source.accesosList.map(function (a) {
      return {
        via: String(a && a.via != null ? a.via : '').trim(),
        fecha: String(a && a.fecha != null ? a.fecha : '').trim(),
      };
    });
    ensurePatientAccesos(target);
    return;
  }
  if (source.viaAcceso || source.accesoFecha) {
    if (!Array.isArray(target.accesosList) || !target.accesosList.some(function (a) {
      return String(a && a.via || '').trim();
    })) {
      target.viaAcceso = source.viaAcceso || target.viaAcceso;
      target.accesoFecha = source.accesoFecha || target.accesoFecha;
      ensurePatientAccesos(target);
    }
  }
}
