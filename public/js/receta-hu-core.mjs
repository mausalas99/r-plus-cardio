/** Helpers puros para receta médica HU (000-061-R-06-12). */

export const DEFAULT_RECETA_HU_CONSULT_SERVICES = [
  'Nefrología',
  'Oncología',
  'Cardiología',
  'Endocrinología',
  'Gastroenterología',
  'Neurología',
];

export function normalizeRecetaHuConsultServices(list) {
  const seen = new Set();
  const out = [];
  const src = Array.isArray(list) && list.length ? list : DEFAULT_RECETA_HU_CONSULT_SERVICES;
  for (const item of src) {
    const s = String(item || '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.length ? out : DEFAULT_RECETA_HU_CONSULT_SERVICES.slice();
}

export function emptyRecetaHuMedRow() {
  return { medicamento: '', presentacion: '', dosis: '' };
}

export function emptyRecetaHuProximaCitaRow() {
  return { plazo: '2 semanas', servicio: '', texto: '', fecha: '' };
}

export function normalizeRecetaHuProximaCitaRow(row) {
  const src = row && typeof row === 'object' ? row : {};
  const plazo = String(src.plazo != null ? src.plazo : '2 semanas').trim() || '2 semanas';
  const servicio = String(src.servicio != null ? src.servicio : '').trim();
  let texto = String(src.texto != null ? src.texto : '').trim();
  if (!texto && servicio) texto = buildProximaCitaText(plazo, servicio);
  return {
    plazo: plazo,
    servicio: servicio,
    texto: texto,
    fecha: String(src.fecha != null ? src.fecha : '').trim(),
  };
}

function migrateLegacyProximaCitas(src) {
  if (Array.isArray(src.proximasCitas) && src.proximasCitas.length) {
    return src.proximasCitas
      .map(normalizeRecetaHuProximaCitaRow)
      .filter(function (row) {
        return row.texto || row.servicio || row.fecha;
      });
  }
  const legacyText = String(src.proximaCita != null ? src.proximaCita : '').trim();
  const legacyFecha = String(src.proximaCitaFecha != null ? src.proximaCitaFecha : '').trim();
  if (!legacyText && !legacyFecha) return [];
  return [
    normalizeRecetaHuProximaCitaRow({
      plazo: src.proximaPlazo,
      servicio: '',
      texto: legacyText,
      fecha: legacyFecha,
    }),
  ];
}

export function formatProximasCitasForPdf(rows) {
  const items = (Array.isArray(rows) ? rows : [])
    .map(normalizeRecetaHuProximaCitaRow)
    .filter(function (row) {
      return row.texto || row.servicio || row.fecha;
    });
  const textLines = items
    .map(function (row) {
      return row.texto || buildProximaCitaText(row.plazo, row.servicio);
    })
    .filter(Boolean);
  const fechaLines = items
    .map(function (row) {
      return row.fecha;
    })
    .filter(Boolean);
  return {
    proximaCita: textLines.join('\n'),
    proximaCitaFecha: fechaLines.join('\n'),
  };
}

export function normalizeRecetaHuDraft(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const meds = Array.isArray(src.meds) ? src.meds : [];
  const labs = Array.isArray(src.labs) ? src.labs : [];
  return {
    fecha: String(src.fecha != null ? src.fecha : ''),
    meds: meds.map(function (row) {
      return {
        medicamento: String(row && row.medicamento != null ? row.medicamento : ''),
        presentacion: String(row && row.presentacion != null ? row.presentacion : ''),
        dosis: String(row && row.dosis != null ? row.dosis : ''),
      };
    }).filter(function (row) {
      return row.medicamento.trim() || row.presentacion.trim() || row.dosis.trim();
    }),
    labs: labs.map(function (x) {
      return String(x || '');
    }),
    cuidados: String(src.cuidados != null ? src.cuidados : ''),
    proximasCitas: migrateLegacyProximaCitas(src),
    proximaPlazo: String(src.proximaPlazo != null ? src.proximaPlazo : '2 semanas'),
  };
}

export function formatRecetaHuFecha(d) {
  const dt = d instanceof Date ? d : new Date();
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function buildProximaCitaText(plazo, servicio) {
  const p = String(plazo || '').trim() || '2 semanas';
  const s = String(servicio || '').trim();
  if (!s) return '';
  return 'Acudir en ' + p + ' a consulta de ' + s;
}

/**
 * @param {{
 *   patient: { nombre?: string, registro?: string, servicio?: string },
 *   draft: ReturnType<typeof normalizeRecetaHuDraft>,
 *   doctorName?: string,
 *   cedulaProfesional?: string,
 * }} args
 */
export function buildRecetaHuGeneratePayload(args) {
  const patient = (args && args.patient) || {};
  const draft = normalizeRecetaHuDraft(args && args.draft);
  const fecha = draft.fecha || formatRecetaHuFecha(new Date());
  const proximaPdf = formatProximasCitasForPdf(draft.proximasCitas);
  return {
    patient: {
      nombre: String(patient.nombre || ''),
      registro: String(patient.registro || ''),
      servicio: String(patient.servicio || ''),
    },
    fecha: fecha,
    meds: draft.meds.filter(function (row) {
      return row.medicamento.trim() || row.presentacion.trim() || row.dosis.trim();
    }),
    labs: draft.labs.map(function (x) {
      return String(x || '').trim();
    }).filter(Boolean),
    cuidados: draft.cuidados,
    proximasCitas: draft.proximasCitas,
    proximaCita: proximaPdf.proximaCita,
    proximaCitaFecha: proximaPdf.proximaCitaFecha,
    doctorName: String(args && args.doctorName ? args.doctorName : ''),
    cedulaProfesional: String(args && args.cedulaProfesional ? args.cedulaProfesional : ''),
  };
}
