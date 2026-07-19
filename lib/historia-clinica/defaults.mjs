export const HC_INTERROGADO_NEGADO = 'Interrogado y negado';

/**
 * @param {Record<string, string>} ipasSystems
 * @returns {Record<string, { checks: string[]; descripcion: string; negado: boolean }>}
 */
function defaultIpasBlocks(ipasSystems = {}) {
  /** @type {Record<string, { checks: string[]; descripcion: string; negado: boolean }>} */
  const ipas = {};
  for (const id of Object.keys(ipasSystems)) {
    ipas[id] = { checks: [], descripcion: HC_INTERROGADO_NEGADO, negado: true };
  }
  return ipas;
}

/**
 * @param {string} patientId
 * @param {{ ipasSystems?: Record<string, string> }} catalogs
 * @param {{ labLookbackHours?: number; createdAt?: string }} [opts]
 */
export function defaultHistoriaClinicaData(patientId, catalogs = {}, opts = {}) {
  const now = opts.createdAt || new Date().toISOString();
  const labLookbackHours =
    opts.labLookbackHours != null && Number.isFinite(Number(opts.labLookbackHours))
      ? Number(opts.labLookbackHours)
      : 48;

  return {
    patientId: String(patientId),
    createdAt: now,
    updatedAt: now,
    editMode: false,
    labLookbackHours,
    labAnchor: null,
    labsAtAdmission: null,
    meta: { admissionConfirmedLabs: false },
    identificacion: {},
    motivoConsulta: '',
    apnp: {
      tabaquismoDetail: { status: 'negado' },
      alcoholismoDetail: { status: 'negado' },
    },
    app: {
      conditions: [],
      customConditions: [],
      conditionDetails: {},
      cirugias: [],
      hospitalizaciones: [],
      alergiasNegado: false,
      alergiaMedicamentos: [],
      traumaticosEntries: [],
      transfusionesEntries: [],
      descripcionDetallada: '',
      medicamentosActuales: [],
      inmunizaciones: '',
    },
    ahf: {
      conditions: [],
      customConditions: [],
      entries: [],
      descripcionDetallada: '',
    },
    genero: {},
    sexual: {
      portadorVih: 'negado',
      ets: 'NEGADAS',
    },
    padecimientoActual: '',
    datosNegados: HC_INTERROGADO_NEGADO,
    ipas: defaultIpasBlocks(catalogs.ipasSystems || {}),
    signosVitalesIngreso: '',
  };
}

/**
 * @param {Record<string, { checks: string[]; descripcion: string; negado?: boolean }>} ipas
 * @param {string[]} systemIds
 */
export function applyInterrogadoNegadoAllIpas(ipas, systemIds) {
  const out = Object.assign({}, ipas || {});
  (systemIds || []).forEach(function (id) {
    out[id] = { checks: [], descripcion: HC_INTERROGADO_NEGADO, negado: true };
  });
  return out;
}
