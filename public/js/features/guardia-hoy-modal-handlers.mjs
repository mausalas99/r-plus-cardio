/**
 * Guardia hoy modal — persist selections and wire interactions.
 */
import { fetchClinicalScopeContextFromDb } from '../clinical-access-runtime.mjs';
import { publishClinicalTeamsToLan, toastTeamLanPublishResult } from './clinical-teams/teams-guardia-bridge.mjs';
import { syncLanHostClinicalMetaToDisk } from '../lan-host-rank-policy.mjs';

function dbApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}

function toast(msg, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(msg, type);
  }
}

/**
 * @param {NodeListOf<HTMLSelectElement>|HTMLSelectElement[]} selects
 * @returns {Promise<{ ok: boolean, activated: boolean }>}
 */
export async function persistGuardiaSelections(selects) {
  const api = dbApi();
  if (!api?.dbClinicalTeamsGuardiaSet) {
    toast('Base clínica no disponible.', 'error');
    return { ok: false, activated: false };
  }

  const list = [...selects];
  if (!list.length) return { ok: true, activated: false };

  let activated = false;
  for (const sel of list) {
    const teamId = String(sel.getAttribute('data-team-id') || '');
    const pickUserId = String(sel.value || '');
    if (!teamId || !pickUserId) continue;
    const res = await api.dbClinicalTeamsGuardiaSet({ teamId, userId: pickUserId });
    if (!res?.ok) {
      toast(res?.error || 'No se guardó la guardia.', 'error');
      return { ok: false, activated: false };
    }
    activated = true;
  }

  await fetchClinicalScopeContextFromDb();
  document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed'));
  if (activated) {
    await syncLanHostClinicalMetaToDisk();
    const lanPush = await publishClinicalTeamsToLan();
    toastTeamLanPublishResult(lanPush, 'Guardia hoy activada.');
  }
  return { ok: true, activated };
}

function wireSelfActivateButtons(body, userId, finish, persistGuardiaSelectionsFn) {
  let selfBusy = false;
  body.querySelectorAll('.guardia-hoy-self-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (selfBusy) return;
      void (async () => {
        const tid = String(btn.getAttribute('data-team-id') || '');
        const sel = body.querySelector(`select.guardia-hoy-r1-select[data-team-id="${tid}"]`);
        if (!sel) {
          toast('No se encontró el equipo.', 'error');
          return;
        }
        sel.value = userId;
        selfBusy = true;
        const prevLabel = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Activando…';
        try {
          const result = await persistGuardiaSelectionsFn([sel]);
          if (!result.ok) return;
          finish({ proceed: true, activated: result.activated });
        } finally {
          selfBusy = false;
          btn.disabled = false;
          btn.textContent = prevLabel;
        }
      })();
    });
  });
}

/**
 * @param {object} refs
 * @param {HTMLElement} refs.bd
 * @param {HTMLElement} refs.body
 * @param {HTMLFormElement} refs.form
 * @param {string} refs.userId
 * @returns {Promise<{ proceed: boolean, activated?: boolean }>}
 */
export function bindGuardiaHoyModalActions({ bd, body, form, userId }) {
  return new Promise((resolve) => {
    const cleanup = () => {
      bd.classList.remove('open');
      bd.setAttribute('aria-hidden', 'true');
      form.removeEventListener('submit', onSubmit);
      document.getElementById('guardia-hoy-btn-skip')?.removeEventListener('click', onSkip);
      document.getElementById('guardia-hoy-btn-cancel')?.removeEventListener('click', onCancel);
      bd.removeEventListener('click', onBackdrop);
      body.querySelectorAll('.guardia-hoy-self-btn').forEach((btn) => {
        btn.replaceWith(btn.cloneNode(true));
      });
    };

    const finish = (result) => {
      cleanup();
      resolve(result);
    };

    const onSkip = () => finish({ proceed: true, activated: false });
    const onCancel = () => finish({ proceed: false });
    const onBackdrop = (ev) => {
      if (ev.target === bd) onCancel();
    };

    wireSelfActivateButtons(body, userId, finish, persistGuardiaSelections);

    const onSubmit = async (ev) => {
      ev.preventDefault();
      const selects = body.querySelectorAll('select.guardia-hoy-r1-select');
      if (!selects.length) {
        finish({ proceed: true, activated: false });
        return;
      }
      const result = await persistGuardiaSelections(selects);
      if (!result.ok) {
        finish({ proceed: false });
        return;
      }
      finish({ proceed: true, activated: result.activated });
    };

    form.addEventListener('submit', onSubmit);
    document.getElementById('guardia-hoy-btn-skip')?.addEventListener('click', onSkip);
    document.getElementById('guardia-hoy-btn-cancel')?.addEventListener('click', onCancel);
    bd.addEventListener('click', onBackdrop);
  });
}
