import {
  conflictSnapshotsMatchForAutoResolve,
  pickDiffKeys,
  summarizeConflictFieldValue,
  formatFieldLabel,
} from '../lan-conflict-silent-match.mjs';
import { buildClinicalConflictModalHtml, wireClinicalConflictModal } from './clinical-conflict-modal.mjs';

export { conflictSnapshotsMatchForAutoResolve, pickDiffKeys, summarizeConflictFieldValue, formatFieldLabel };
export { buildConflictModalTitle, buildConflictActionCopy } from './clinical-conflict-actions.mjs';
export { buildConflictContextHtml } from './clinical-conflict-context.mjs';
export { buildConflictDiffParts, buildConflictDiffHtml } from './clinical-conflict-diff.mjs';

const BACKDROP_ID = 'clinical-conflict-backdrop';

function closeClinicalConflictViewer() {
  if (typeof document === 'undefined') return;
  const prev = document.getElementById(BACKDROP_ID);
  if (prev) prev.remove();
}

/**
 * @param {{
 *   draftId?: string,
 *   conflictingKeys?: string[],
 *   localData?: Record<string, unknown>,
 *   serverData?: Record<string, unknown>,
 *   context?: object,
 *   onUseServer?: () => void,
 *   onEditDraft?: () => void,
 *   onClose?: () => void,
 * }} opts
 */
export function openClinicalConflictViewer(opts) {
  if (typeof document === 'undefined') return;
  const { onUseServer, onEditDraft, onClose } = opts || {};
  closeClinicalConflictViewer();
  const built = buildClinicalConflictModalHtml(opts);
  const backdrop = document.createElement('div');
  backdrop.className = 'lab-conflict-backdrop clinical-conflict-backdrop';
  backdrop.id = BACKDROP_ID;
  if (built.draftId) backdrop.dataset.draftId = String(built.draftId);
  backdrop.innerHTML = built.html;
  document.body.appendChild(backdrop);
  wireClinicalConflictModal(backdrop, { onUseServer, onEditDraft, onClose });
}
