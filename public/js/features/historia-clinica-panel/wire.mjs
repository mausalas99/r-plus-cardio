import { wireClinicalHistoryUppercase } from '../historia-clinica-uppercase.mjs';
import { rt } from './runtime.mjs';
import { openLabPickModal } from './labs.mjs';
import { compileHistoriaPlainText, setByPath } from './render-html.mjs';
import { hcState, replaceDirtyKeys } from './state.mjs';
import { saveHistoria } from './save.mjs';

export function wireEditToolbar(root, patient, rerender) {
  var editBtn = root.querySelector('#hc-edit-toggle');
  if (editBtn) {
    editBtn.onclick = function () {
      hcState.editMode = true;
      hcState.step = (hcState.data.meta && hcState.data.meta.lastStep) || 1;
      replaceDirtyKeys(new Set());
      rerender(root);
    };
  }
  var copyBtn = root.querySelector('#hc-copy');
  if (copyBtn) {
    copyBtn.onclick = async function () {
      var text = compileHistoriaPlainText(patient);
      var ok = await rt.copyToClipboardSafe(text);
      rt.showToast(ok ? 'Historia copiada.' : 'No se pudo copiar.', ok ? 'success' : 'error');
    };
  }
  var cancelBtn = root.querySelector('#hc-cancel-edit');
  if (cancelBtn) {
    cancelBtn.onclick = function () {
      hcState.editMode = false;
      rerender(root);
    };
  }
  var saveBtn = root.querySelector('#hc-save');
  if (saveBtn) {
    saveBtn.onclick = function () {
      saveHistoria(root, patient, rerender, false);
    };
  }
}

export function wirePathInputs(root) {
  root.querySelectorAll('[data-hc-path]').forEach(function (el) {
    el.addEventListener('input', function () {
      setByPath(el.getAttribute('data-hc-path'), el.value);
    });
  });
  wireClinicalHistoryUppercase(root);
}

export function wireStepNavigation(root, rerender) {
  root.querySelectorAll('[data-hc-step]').forEach(function (btn) {
    btn.onclick = function () {
      var n = parseInt(btn.getAttribute('data-hc-step'), 10);
      if (Number.isFinite(n)) {
        hcState.step = n;
        if (hcState.data.meta) hcState.data.meta.lastStep = n;
        rerender(root);
      }
    };
  });
  var prev = root.querySelector('#hc-prev');
  if (prev) {
    prev.onclick = function () {
      hcState.step = Math.max(1, hcState.step - 1);
      rerender(root);
    };
  }
  var next = root.querySelector('#hc-next');
  if (next) {
    next.onclick = function () {
      hcState.step = Math.min(3, hcState.step + 1);
      if (hcState.data.meta) hcState.data.meta.lastStep = hcState.step;
      rerender(root);
    };
  }
}

export function wireLabAndVitalsActions(root, patient, rerender) {
  var resync = root.querySelector('#hc-resync-labs');
  if (resync) {
    resync.onclick = function () {
      openLabPickModal(patient, true, rerender);
    };
  }
  var pick = root.querySelector('#hc-pick-labs');
  if (pick) {
    pick.onclick = function () {
      openLabPickModal(patient, false, rerender);
    };
  }
  var goEa = root.querySelector('#hc-go-estado-actual');
  if (goEa) {
    goEa.onclick = function () {
      if (typeof rt.navigateToEstadoActualPanel === 'function') {
        rt.navigateToEstadoActualPanel();
      } else {
        rt.showToast('Abre la pestaña Estado actual en Clínico.', 'info');
      }
    };
  }
}

export function wirePanel(root, patient, rerender) {
  wireEditToolbar(root, patient, rerender);
  wirePathInputs(root);
  wireStepNavigation(root, rerender);
  wireLabAndVitalsActions(root, patient, rerender);
}
