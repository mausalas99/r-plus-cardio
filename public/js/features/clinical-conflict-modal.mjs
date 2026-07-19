import { buildConflictActionCopy, buildConflictModalTitle } from './clinical-conflict-actions.mjs';
import { buildConflictDiffParts } from './clinical-conflict-diff.mjs';
import { buildConflictContextHtml } from './clinical-conflict-context.mjs';

/**
 * @param {{
 *   draftId?: string,
 *   conflictingKeys?: string[],
 *   localData?: Record<string, unknown>,
 *   serverData?: Record<string, unknown>,
 *   context?: object,
 * }} opts
 */

import { escHtml } from '../dom-escape.mjs';
export function buildClinicalConflictModalHtml(opts) {
  const { draftId, conflictingKeys, localData, serverData, context } = opts || {};
  const contextHtml = buildConflictContextHtml(context);
  const actions = buildConflictActionCopy(context);
  const modalTitle = buildConflictModalTitle(context);
  const isRoomBundle = context && context.entityType === 'roomBundle';
  const diffParts = isRoomBundle
    ? {
        keyCount: 1,
        summaryHtml:
          '<p class="clinical-conflict-summary-empty">El host rechazó tu paquete de sala (revisión distinta). Usa la versión del servidor o cierra y resuelve después desde ⇄.</p>',
        detailHtml: '',
      }
    : buildConflictDiffParts({ conflictingKeys, localData, serverData });
  const detailBlock = diffParts.detailHtml
    ? '<details class="clinical-conflict-details">' +
      '<summary>Ver comparación por sección</summary>' +
      '<div class="clinical-conflict-diff-wrap">' +
      diffParts.detailHtml +
      '</div></details>'
    : '';
  return {
    html:
      '<div class="lab-conflict-modal clinical-conflict-modal" role="dialog" aria-modal="true" aria-labelledby="clinical-conflict-title">' +
      '<header class="clinical-conflict-header clinical-conflict-header--plain">' +
      '<div class="clinical-conflict-header-text">' +
      '<h3 id="clinical-conflict-title">' + escHtml(modalTitle) + '</h3>' +
      '<p class="clinical-conflict-tagline">' + escHtml(actions.tagline) + '</p>' +
      '</div></header>' +
      contextHtml +
      diffParts.summaryHtml +
      '<div class="lab-conflict-actions clinical-conflict-actions">' +
      '<button type="button" class="btn-conflict-primary" id="clinical-conflict-use-server">' +
      escHtml(actions.primaryTitle) +
      '<span class="btn-conflict-hint">' + escHtml(actions.primaryHint) + '</span></button>' +
      '<button type="button" class="btn-conflict-secondary" id="clinical-conflict-edit-draft">' +
      escHtml(actions.secondaryTitle) +
      '<span class="btn-conflict-hint">' + escHtml(actions.secondaryHint) + '</span></button>' +
      '<button type="button" class="btn-conflict-cancel" id="clinical-conflict-close">Cerrar sin decidir</button>' +
      '</div>' +
      detailBlock +
      '</div>',
    draftId,
  };
}

/**
 * @param {HTMLElement} backdrop
 * @param {{ onUseServer?: () => void, onEditDraft?: () => void, onClose?: () => void }} handlers
 */
export function wireClinicalConflictModal(backdrop, handlers) {
  const dismiss = (cb) => {
    backdrop.remove();
    if (typeof cb === 'function') cb();
  };
  const useServer = backdrop.querySelector('#clinical-conflict-use-server');
  const editDraft = backdrop.querySelector('#clinical-conflict-edit-draft');
  const closeBtn = backdrop.querySelector('#clinical-conflict-close');
  if (useServer) useServer.addEventListener('click', () => dismiss(handlers.onUseServer));
  if (editDraft) editDraft.addEventListener('click', () => dismiss(handlers.onEditDraft));
  if (closeBtn) closeBtn.addEventListener('click', () => dismiss(handlers.onClose));
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) dismiss(handlers.onClose);
  });
}
