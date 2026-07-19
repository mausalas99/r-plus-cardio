import { exportRecetaHuPdf } from './receta-hu-export.mjs';
import {
  recetaHuCommitMedFromCompose,
  recetaHuCommitLabFromCompose,
  recetaHuCommitProximaFromCompose,
  recetaHuAddConsultService,
  recetaHuRemoveMedRow,
  recetaHuRemoveLabRow,
  recetaHuRemoveProximaRow,
  recetaHuOnConsultServicePick,
} from './receta-hu-actions.mjs';
import { aid, persistDraft, readDraftFromDom } from './receta-hu-shared.mjs';

function dispatchRecetaHuAction(action, actionBtn) {
  if (action === 'export') {
    exportRecetaHuPdf();
    return true;
  }
  if (action === 'add-med') {
    recetaHuCommitMedFromCompose();
    return true;
  }
  if (action === 'add-lab') {
    recetaHuCommitLabFromCompose();
    return true;
  }
  if (action === 'add-proxima') {
    recetaHuCommitProximaFromCompose();
    return true;
  }
  if (action === 'add-service') {
    recetaHuAddConsultService();
    return true;
  }
  if (action === 'remove-med') {
    var medIdx = parseInt(actionBtn.getAttribute('data-med-idx'), 10);
    if (!isNaN(medIdx)) recetaHuRemoveMedRow(medIdx);
    return true;
  }
  if (action === 'remove-lab') {
    var labIdx = parseInt(actionBtn.getAttribute('data-lab-idx'), 10);
    if (!isNaN(labIdx)) recetaHuRemoveLabRow(labIdx);
    return true;
  }
  if (action === 'remove-proxima') {
    var proxIdx = parseInt(actionBtn.getAttribute('data-proxima-idx'), 10);
    if (!isNaN(proxIdx)) recetaHuRemoveProximaRow(proxIdx);
    return true;
  }
  if (action === 'open-profile') {
    if (typeof window.openProfileModal === 'function') window.openProfileModal();
    return true;
  }
  return false;
}

function handleRecetaHuClick(ev, root) {
  var actionBtn = ev.target && ev.target.closest ? ev.target.closest('[data-receta-hu-action]') : null;
  if (!actionBtn || !root.contains(actionBtn)) return;
  var action = actionBtn.getAttribute('data-receta-hu-action');
  if (!action) return;
  if (action !== 'open-profile') ev.preventDefault();
  dispatchRecetaHuAction(action, actionBtn);
}

function isComposeField(id) {
  return (
    id === 'receta-hu-compose-med-n' ||
    id === 'receta-hu-compose-med-p' ||
    id === 'receta-hu-compose-med-d' ||
    id === 'receta-hu-compose-lab' ||
    id === 'receta-hu-compose-proxima-plazo' ||
    id === 'receta-hu-compose-proxima-texto' ||
    id === 'receta-hu-compose-proxima-fecha'
  );
}

function handleRecetaHuInput(ev) {
  var t = ev.target;
  if (!t || !t.closest('#receta-hu-container')) return;
  if (isComposeField(t.id)) return;
  var pid = aid();
  if (pid) persistDraft(pid, readDraftFromDom());
}

function handleRecetaHuChange(ev) {
  var t = ev.target;
  if (t && t.id === 'receta-hu-consult-servicio') {
    recetaHuOnConsultServicePick();
    return;
  }
  if (t && t.id === 'receta-hu-compose-proxima-plazo') {
    recetaHuOnConsultServicePick();
    return;
  }
  var pid = aid();
  if (pid) persistDraft(pid, readDraftFromDom());
}

function handleRecetaHuKeydown(ev) {
  if (ev.key !== 'Enter') return;
  var t = ev.target;
  if (!t) return;
  if (t.id === 'receta-hu-compose-lab') {
    ev.preventDefault();
    recetaHuCommitLabFromCompose();
    return;
  }
  if (t.id === 'receta-hu-compose-med-n' || t.id === 'receta-hu-compose-med-p' || t.id === 'receta-hu-compose-med-d') {
    ev.preventDefault();
    recetaHuCommitMedFromCompose();
    return;
  }
  if (t.id === 'receta-hu-compose-proxima-texto' || t.id === 'receta-hu-compose-proxima-fecha') {
    ev.preventDefault();
    recetaHuCommitProximaFromCompose();
  }
}

export function bindRecetaHuEvents(root) {
  if (root.dataset.eventsBound === '1') return;
  root.dataset.eventsBound = '1';

  root.addEventListener('click', function (ev) {
    handleRecetaHuClick(ev, root);
  });
  root.addEventListener('input', handleRecetaHuInput);
  root.addEventListener('change', handleRecetaHuChange);
  root.addEventListener('keydown', handleRecetaHuKeydown);
}
