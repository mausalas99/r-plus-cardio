/**
 * Mapa categoría SOAP → id de campo en plantilla legacy (modal expediente).
 */
export const SOAP_LEGACY_FIELD_IDS = {
  analgesia: 'soap-analgesia',
  antiemeticos: 'soap-antiemeticos',
  sedacion: 'soap-sedacion',
  antiepilepticos: 'soap-antiepilepticos',
  antiparkinsonianos: 'soap-antiparkinsonianos',
  antidotos: 'soap-antidotos',
  viaAerea: 'soap-via-aerea',
  antihta: 'soap-antihta',
  diuretico: 'soap-diureticos',
  diureticos: 'soap-diureticos',
  antitromboticos: 'soap-antitromboticos',
  anticoagulacion: 'soap-anticoagulacion',
  antiarritmicos: 'soap-antiarritmicos',
  estatinas: 'soap-estatinas',
  abx: 'soap-abx',
  transfusiones: 'soap-transfusiones',
  vasop: 'soap-vasop',
  nm: 'soap-nm-soporte',
};

/** @param {string} cat */
export function soapLegacyFieldIdForCategory(cat) {
  return SOAP_LEGACY_FIELD_IDS[/** @type {keyof typeof SOAP_LEGACY_FIELD_IDS} */ (cat)] || null;
}

/** Todos los ids de campos medicamentosos del modal legacy (para limpiar). */
export const SOAP_LEGACY_MED_FIELD_IDS = Object.values(SOAP_LEGACY_FIELD_IDS);
