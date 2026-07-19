import { MED_FIELD_KEYS } from './estado-actual-data-constants.mjs';

/** @returns {typeof emptyEstadoClinico extends (...a: infer R) => infer V ? V : never} */
export function emptyEstadoClinico() {
  return {
    four: '',
    esferas: '',
    analgesia: '',
    antiemeticos: '',
    sedacion: '',
    antiepilepticos: '',
    antiparkinsonianos: '',
    antidotos: '',
    viaAerea: '',
    abx: '',
    transfusiones: '',
    antihta: '',
    diureticos: '',
    antitromboticos: '',
    anticoagulacion: '',
    antiarritmicos: '',
    estatinas: '',
    vasop: '',
    nm: '',
    soporte: '',
    tempContext: '',
    dieta: '',
    kcalKg: '',
    kcal: '',
    proteinG: '',
    pesoRef: '',
  };
}

/** @returns {Record<string, string>} */
export function emptyPendienteReceta() {
  /** @type {Record<string, string>} */
  const o = {};
  for (var k of Object.keys(emptyEstadoClinico())) {
    o[k] = '';
  }
  return o;
}

/** @returns {typeof emptyMonitoreo extends (...a: infer R) => infer V ? V : never} */
export function emptyMonitoreo() {
  /** @type {Record<string, boolean>} */
  var confirmado = { dieta: false };
  for (var mk of MED_FIELD_KEYS) {
    confirmado[mk] = false;
  }
  return {
    estadoClinico: emptyEstadoClinico(),
    confirmado,
    pendienteReceta: emptyPendienteReceta(),
    historial: [],
    textoGuardado: { text: '', savedAt: null },
    bombaInsulinaAlgoritmo: null,
  };
}
