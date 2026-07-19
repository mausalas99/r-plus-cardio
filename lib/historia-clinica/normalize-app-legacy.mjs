import { ERC_CONDITION_ID, normalizeErcDetail, syncErcMedicationsToApp } from './erc-detail.mjs';
import { trim } from './string-util.mjs';


/**
 * @param {object} app
 */
export function normalizeAppLegacyLists(app) {
  if (!Array.isArray(app.alergiaMedicamentos)) app.alergiaMedicamentos = [];
  if (!Array.isArray(app.traumaticosEntries)) app.traumaticosEntries = [];
  if (!Array.isArray(app.transfusionesEntries)) app.transfusionesEntries = [];
  if (!Array.isArray(app.medicamentosActuales)) {
    const legacyMed = trim(app.medicamentosActuales);
    app.medicamentosActuales = legacyMed
      ? [
          {
            id: 'legacy_med',
            medication: legacyMed,
            route: '',
            dosage: '',
            frequency: '',
          },
        ]
      : [];
  }
}

/**
 * @param {object} app
 */
export function migrateAppLegacyStrings(app) {
  if (trim(app.alergias) && !app.alergiaMedicamentos.length) {
    app.alergiaMedicamentos.push({ id: 'legacy_al', medication: trim(app.alergias) });
    app.alergiasNegado = false;
  }
  if (trim(app.traumaticos) && !app.traumaticosEntries.length) {
    app.traumaticosEntries.push({
      id: 'legacy_tr',
      description: trim(app.traumaticos),
      date: null,
    });
  }
  if (trim(app.transfusiones) && !app.transfusionesEntries.length) {
    app.transfusionesEntries.push({
      id: 'legacy_tf',
      units: '',
      adverseReactions: trim(app.transfusiones),
      date: null,
    });
  }

  delete app.alergias;
  delete app.traumaticos;
  delete app.transfusiones;
}

/**
 * @param {object} app
 */
export function finalizeAppAllergiesAndErc(app) {
  if (app.alergiasNegado !== true && app.alergiaMedicamentos.length > 0) {
    app.alergiasNegado = false;
  }
  if (app.alergiasNegado !== false && !app.alergiaMedicamentos.length) {
    app.alergiasNegado = app.alergiasNegado === true;
  }

  if ((app.conditions || []).indexOf(ERC_CONDITION_ID) >= 0) {
    app.conditionDetails[ERC_CONDITION_ID] = normalizeErcDetail(
      app.conditionDetails[ERC_CONDITION_ID]
    );
  }

  return syncErcMedicationsToApp(app);
}
