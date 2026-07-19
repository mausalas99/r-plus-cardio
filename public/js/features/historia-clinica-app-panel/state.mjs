import { APP_DEDICATED_IDS, normalizeAppData } from '../../../../lib/historia-clinica/normalize-app.mjs';

export function defaultApp() {
  return {
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
  };
}

export function ensureApp(app) {
  return normalizeAppData(app, defaultApp());
}

export function catalogOptions(map) {
  return Object.keys(map || {})
    .filter(function (id) {
      return !APP_DEDICATED_IDS.has(id);
    })
    .map(function (id) {
      return { id, label: map[id] };
    });
}

export function allConditionIds(app, catalog) {
  const ids = (app.conditions || []).slice();
  (app.customConditions || []).forEach(function (c) {
    if (c && c.id && ids.indexOf(c.id) < 0) ids.push(c.id);
  });
  return ids
    .filter(function (id) {
      return !APP_DEDICATED_IDS.has(id);
    })
    .map(function (id) {
      return {
        id,
        label:
          (catalog && catalog[id]) ||
          ((app.customConditions || []).find(function (c) {
            return c && c.id === id;
          }) || {}).label ||
          id,
        custom: !(catalog && catalog[id]),
      };
    });
}
