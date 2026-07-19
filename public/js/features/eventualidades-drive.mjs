import { saveState } from '../app-state.mjs';
import { touchClinicalSessionActivity } from '../clinical-access-runtime.mjs';
import { createMutationBuilder } from '../versioned-mutation.mjs';
import {
  isLanSessionConfiguredForRest,
  lanPushPatientVersioned,
} from './lan-sync.mjs';
import { filterNewEventualidades } from '../../../lib/drive-import/merge-eventualidades.mjs';
import { appendEventualidad } from './eventualidades-store.mjs';
import {
  ensureEventualidades,
  hostPatientMutationBase,
  DRIVE_IMPORT_LAN_MS,
} from './eventualidades-render.mjs';

function driveImportLanTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('lan-timeout'));
      }, ms);
    }),
  ]);
}

export async function applyDriveImportEventualidades(patient, incoming) {
  if (!patient) return { ok: false, added: 0, skipped: 0 };
  let store = ensureEventualidades(patient);
  const { toAdd, skipped } = filterNewEventualidades(store.entries, incoming || []);
  for (let i = 0; i < toAdd.length; i += 1) {
    store = appendEventualidad(store, toAdd[i].text, '', toAdd[i].at);
  }
  if (!toAdd.length) return { ok: true, added: 0, skipped };
  patient.eventualidades = store;
  await saveState({ immediate: true });
  touchClinicalSessionActivity({ force: true });

  if (!isLanSessionConfiguredForRest()) {
    return { ok: true, added: toAdd.length, skipped };
  }

  const mutation = createMutationBuilder('patient', patient.id)
    .captureBase(hostPatientMutationBase(patient, null))
    .set('eventualidades', store)
    .build();
  void driveImportLanTimeout(lanPushPatientVersioned(patient.id, mutation), DRIVE_IMPORT_LAN_MS)
    .then(function (out) {
      if (out && out.ok) {
        if (out.data) Object.assign(patient, out.data);
        saveState();
      }
    })
    .catch(function () {
      /* local copy already saved */
    });
  return { ok: true, added: toAdd.length, skipped, lanDeferred: true };
}
