/** LAN directorio modal open/close. */
import { clinicalSessionContext, touchClinicalSessionActivity } from '../../clinical-access-runtime.mjs';
import { canViewLanUserDirectory } from '../../clinical-privileges.mjs';
import { flushPendingClinicalOpsLanSnapshot } from '../../clinical-ops-lan.mjs';
import { toast, escapeHtml } from './shared.mjs';
import { lanDirRt } from './teams-roster-lan-state.mjs';
import {
  lanUsersModalBackdropEl,
  lanUsersModalBodyEl,
} from './teams-roster-lan-dom.mjs';
import { ensureLanDirectoryFilterDelegation } from './teams-roster-lan-filters.mjs';
import {
  loadLanUsersDirectoryIntoHost,
  pullLanDirectoryFromHostIfDue,
} from './teams-roster-lan-load.mjs';

export async function openLanUsersDirectoryModal() {
  const user = clinicalSessionContext.user || {};
  if (!canViewLanUserDirectory(user)) {
    toast(
      'Solo R4, Admin o quien tenga privilegios de administración puede abrir el directorio LAN.',
      'warn'
    );
    return;
  }

  const bd = lanUsersModalBackdropEl();
  const host = lanUsersModalBodyEl();
  if (!bd || !host) {
    console.error('[Directorio LAN] Falta #clinical-lan-users-backdrop o #clinical-lan-users-panel-body');
    toast(
      'No se pudo abrir el directorio (falta el diálogo en la UI). Ejecuta npm run build:ui y reinicia R+.',
      'error'
    );
    return;
  }

  host.innerHTML = '<p class="clinical-teams-empty">Cargando directorio…</p>';
  document.body.classList.add('clinical-lan-directory-open');
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');

  lanDirRt.lastFingerprint = '';
  lanDirRt.freezeAutoRefresh = true;
  ensureLanDirectoryFilterDelegation();
  touchClinicalSessionActivity({ force: true });

  try {
    await pullLanDirectoryFromHostIfDue({ force: true });
    await loadLanUsersDirectoryIntoHost(host, { forceRender: true, forceIpc: true });
    const pendingSnap = await flushPendingClinicalOpsLanSnapshot();
    if (pendingSnap?.changed) {
      await loadLanUsersDirectoryIntoHost(host, { forceRender: true, forceIpc: true });
    }
  } catch (err) {
    console.error('[Directorio LAN]', err);
    host.innerHTML = `<p class="clinical-teams-empty">${escapeHtml(
      err instanceof Error ? err.message : 'No se pudo cargar el directorio.'
    )}</p>`;
  }

}

export function closeLanUsersDirectoryModal() {
  lanDirRt.freezeAutoRefresh = false;
  lanDirRt.lastFingerprint = '';
  const bd = lanUsersModalBackdropEl();
  if (!bd) return;
  bd.classList.remove('open');
  bd.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('clinical-lan-directory-open');
}
