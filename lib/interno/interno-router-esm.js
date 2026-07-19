'use strict';

/** Lazy ESM imports (Node test + server). */
let _esm;

async function loadInternoRouterEsm() {
  if (_esm) return _esm;
  _esm = {
    getInternoScopeContext: (await import('../db/clinical-access-db.mjs')).getInternoScopeContext,
    getSalaInternoAccess: (await import('../db/clinical-access-db.mjs')).getSalaInternoAccess,
    verifySalaInternoToken: (await import('../db/clinical-access-db.mjs')).verifySalaInternoToken,
    normalizeInternoSala: (await import('../db/clinical-access-db.mjs')).normalizeInternoSala,
    touchActiveGuardiaVitalsCheck: (await import('../db/clinical-access-db.mjs'))
      .touchActiveGuardiaVitalsCheck,
    loadCensusPatientIdSet: (await import('../db/clinical-access-db.mjs')).loadCensusPatientIdSet,
    filterInternoScopePatients: (await import('./interno-scope.mjs')).filterInternoScopePatients,
    resolveInternoBoardPatients: (await import('./interno-scope.mjs')).resolveInternoBoardPatients,
    resolveSalaR1GuardiaUserIds: (await import('./interno-scope.mjs')).resolveSalaR1GuardiaUserIds,
    buildInternoBoardDto: (await import('./interno-board.mjs')).buildInternoBoardDto,
    patchGuardiaPendienteComplete: (await import('./interno-pendientes.mjs'))
      .patchGuardiaPendienteComplete,
    buildInternoMedicion: (await import('./interno-vitals.mjs')).buildInternoMedicion,
    applyInternoMedicionToPatient: (await import('./interno-vitals.mjs')).applyInternoMedicionToPatient,
    salaFromSlug: (await import('./sala-slug.mjs')).salaFromSlug,
    renderQrSvg: (await import('./qr-svg.mjs')).renderQrSvg,
  };
  return _esm;
}

module.exports = { loadInternoRouterEsm };
