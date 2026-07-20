/**
 * Salida — Generar hoja IC (.docx) with as-of date.
 */
import { patients, labHistory } from '../../app-state.mjs';
import { setAsyncButtonLoading } from '../../ui-motion.mjs';
import {
  exportWithOutputDirFallback,
  guardDocExportBlocked,
  syncApprovedOutputDir,
} from '../../document-export-client.mjs';
import { rt } from '../expediente/expediente-runtime.mjs';
import { localYmd, resolveClinicalAsOfYmd } from './descongestion-panel.mjs';
import { escHtml, escAttr } from '../../dom-escape.mjs';
import { refreshRpcDateFields } from '../../rpc-date-picker.mjs';

function activePatient() {
  var id = rt.getActiveId && rt.getActiveId();
  if (!id) return null;
  return (
    patients.find(function (p) {
      return p && String(p.id) === String(id);
    }) || null
  );
}

/**
 * @param {HTMLElement | null} mount
 */
export function renderIcHojaExportPanel(mount) {
  if (!mount) return;
  var patient = activePatient();
  if (!patient) {
    mount.innerHTML =
      '<div class="ic-hoja-export" data-ic-hoja-export="1">' +
      '<p class="ea-muted">Selecciona un paciente para generar la hoja IC.</p>' +
      '</div>';
    return;
  }
  var asOf = resolveClinicalAsOfYmd(patient) || localYmd();
  mount.innerHTML =
    '<div class="ic-hoja-export rpc-form-stack" data-ic-hoja-export="1">' +
    '<div class="card">' +
    '<div class="card-header">Hoja de seguimiento IC</div>' +
    '<div class="card-body">' +
    '<p class="ea-muted" style="margin:0 0 12px;">Genera el .docx institucional con los datos del paciente a la fecha indicada.</p>' +
    '<div class="field-group" style="max-width:220px;">' +
    '<label for="ic-hoja-asof">Fecha de corte</label>' +
    '<input type="date" id="ic-hoja-asof" class="profile-input rpc-date-input" value="' +
    escAttr(asOf) +
    '">' +
    '</div>' +
    '<p class="ea-muted" style="margin:8px 0 0;font-size:0.9em;">Paciente: <strong>' +
    escHtml(patient.nombre || '—') +
    '</strong></p>' +
    '</div></div>' +
    '<div class="action-bar">' +
    '<button type="button" class="btn-generate rpc-doc-export" id="btn-gen-ic-hoja" data-ic-hoja-action="generate">' +
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
    '<path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>' +
    '</svg>Generar hoja IC</button>' +
    '</div></div>';
  ensureIcHojaWired(mount);
  refreshRpcDateFields(mount);
}

/**
 * @param {HTMLElement} mount
 */
function ensureIcHojaWired(mount) {
  if (mount.getAttribute('data-ic-hoja-wired') === '1') return;
  mount.setAttribute('data-ic-hoja-wired', '1');
  mount.addEventListener('click', function (ev) {
    var t = /** @type {HTMLElement} */ (ev.target);
    if (!t || !t.closest) return;
    var btn = t.closest('[data-ic-hoja-action="generate"]');
    if (!btn) return;
    ev.preventDefault();
    generateIcHoja();
  });
}

export function generateIcHoja() {
  if (rt.guardMobileDocExport()) return;
  if (guardDocExportBlocked({ isRpcOffline: rt.isRpcOffline, showToast: rt.showToast })) return;
  var patient = activePatient();
  if (!patient) {
    rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  var asOfEl = document.getElementById('ic-hoja-asof');
  var asOfDate = asOfEl && asOfEl.value ? String(asOfEl.value).trim() : localYmd();
  var pid = patient.id;
  var labs = Array.isArray(labHistory[pid]) ? labHistory[pid] : [];
  var patientPayload = Object.assign({}, patient, { labHistory: labs });

  var btn = document.getElementById('btn-gen-ic-hoja');
  setAsyncButtonLoading(btn, true, { loadingText: 'Generando…' });
  rt.incrementPendingJobs();

  function buildPayload(outputDir) {
    var body = { patient: patientPayload, asOfDate: asOfDate };
    if (outputDir) body.outputDir = outputDir;
    return body;
  }
  function selectOutputDir() {
    if (!window.electronAPI || !window.electronAPI.selectOutputDir) {
      return Promise.resolve(undefined);
    }
    return window.electronAPI.selectOutputDir();
  }
  function saveOutputDir(dir) {
    if (!dir) return;
    var st = rt.getSettings() || {};
    st.outputDir = dir;
    localStorage.setItem('rpc-settings', JSON.stringify(st));
    syncApprovedOutputDir(dir);
  }

  exportWithOutputDirFallback({
    url: '/generate-ic-hoja',
    buildPayload: buildPayload,
    defaultFileName: 'hoja-ic.docx',
    selectOutputDir: selectOutputDir,
    saveOutputDir: saveOutputDir,
    onSuccess: function (data) {
      var name =
        data && (data.fileName || data.path)
          ? data.fileName || String(data.path).split(/[/\\]/).pop()
          : 'hoja-ic.docx';
      rt.showToast('Hoja IC guardada: ' + name, 'success');
    },
    onPrompt: function () {
      rt.showToast('Selecciona una carpeta para guardar el documento.', 'error');
    },
    onCancel: function () {
      rt.showToast('No se guardó el documento: no se eligió carpeta.', 'error');
    },
    onError: function (msg) {
      rt.showToast('Error: ' + msg, 'error');
    },
  })
    .catch(function () {
      rt.showToast('Error de conexión', 'error');
    })
    .finally(function () {
      setAsyncButtonLoading(document.getElementById('btn-gen-ic-hoja'), false);
      rt.decrementPendingJobs();
      rt.syncOfflineButtonStates();
    });
}
