/** Barrel: medicamentos receta / SOAP core — re-exporta submódulos sin romper importadores. */
export {
  parseFechaDMYFromTimestampCell,
  extractDiaTratamiento,
  parseFechaDMYToLocalDate,
  calendarDaysSinceFechaDMY,
  advanceDiaInMedSoapText,
  advanceAbxMedTextForManejoDate,
  effectiveDiaTratamiento,
  setDiaTratamientoInDosis,
  incrementMedItemsDiaTratamiento,
} from './med-receta-dates.mjs';

export {
  extractDietNutrients,
  dietNutrientBlobFromCols,
  mergeDietaItems,
  buildDietProposalText,
  resolveDietaDescripcionRaw,
  dietProposalFingerprint,
} from './med-receta-diet.mjs';

export {
  parseIndicacionesPaste,
  parseMedicationPaste,
  looksLikeSomeIndicacionesPaste,
  looksLikeSomeMedicationPaste,
  shouldAutoSelectSoap,
  resolveFechaActualizacion,
} from './med-receta-parse.mjs';

export { applyMedCatalogOverlay, getMedCatalogOverlaySnapshot } from './med-receta-catalog.mjs';

export {
  dosisBeforeSlash,
  extractRecetaNameOnlyDose,
  formatMedicationEgresoLine,
  buildMedRecetaCopyText,
  formatMedicationSoapShort,
  buildMedRecetaNameOnlyText,
  isPrnMedicationItem,
} from './med-receta-format.mjs';

export {
  SOAP_DESTINATION_KEYS,
  SOAP_DESTINATION_LABELS,
  effectiveSoapCategory,
  unassignedOtrosSoapItems,
  classifyMedicationSoapCategory,
  shouldIncludeMedicationInSoap,
} from './med-receta-soap.mjs';
