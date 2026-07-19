import { sortLabHistoryChronological } from './tend-core.mjs';
import { refillGasoExtendedSlot, serieNumFromLabSet } from './tend-group-gaso-slot.mjs';
import {
  ensureGasoExtendedDialog,
  closeGasoExtendedBackdrop,
  showGasoExtendedBackdrop,
  parseFio2Input,
  wireGasoExtendedDialog,
} from './tend-group-gaso-dialog.mjs';

function isAbgAnalysisHidden() {
  return true;
}

function defaultEsc(t) {
  return String(t == null ? '' : t);
}

export function createTendGroupGasoApi(deps, state) {
  function escHtml(t) {
    return (deps.esc || defaultEsc)(t);
  }

  function closeGasoExtended() {
    closeGasoExtendedBackdrop();
  }

  function rerunGasoSlot(bd) {
    var inp = bd.querySelector('.tend-gaso-fio2-input');
    state.gasoExtendedFio2 = parseFio2Input(inp && inp.value, state.gasoExtendedFio2);
    refillGasoExtendedSlot(
      bd.querySelector('.tend-gaso-extended-inner'),
      state.historyDesc[0],
      state.gasoExtendedFio2,
      escHtml
    );
  }

  function openGasoExtended() {
    if (isAbgAnalysisHidden()) {
      if (deps.showToast) deps.showToast('El análisis de gasometría no está disponible en R+.', 'info');
      return;
    }
    var patientId = deps.getActiveId();
    if (!patientId) return;

    var historyDesc = sortLabHistoryChronological(deps.getHistory() || []);
    if (!historyDesc.length) {
      if (deps.showToast) deps.showToast('Sin laboratorio reciente para gasometría.', 'warn');
      return;
    }

    state.patientId = patientId;
    state.historyDesc = historyDesc;

    var latest = historyDesc[0];
    var hasGaso =
      latest &&
      latest.parsedBySection &&
      latest.parsedBySection.GASES &&
      serieNumFromLabSet(latest, 'GASES', 'pH') != null;
    if (!hasGaso) {
      if (deps.showToast) deps.showToast('No hay gasometría en el último estudio.', 'warn');
      return;
    }

    var bd = ensureGasoExtendedDialog(escHtml, closeGasoExtended);
    wireGasoExtendedDialog(bd, state, function () {
      rerunGasoSlot(bd);
    });
    refillGasoExtendedSlot(
      bd.querySelector('.tend-gaso-extended-inner'),
      latest,
      state.gasoExtendedFio2,
      escHtml
    );
    showGasoExtendedBackdrop(bd);
  }

  return { openGasoExtended, closeGasoExtended };
}
