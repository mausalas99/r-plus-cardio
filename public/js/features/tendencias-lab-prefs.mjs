import { formatBhExtrasDisplayLine } from '../labs.js';
import { rt } from './tendencias-runtime-state.mjs';

const LAB_OUTPUT_PREFS_KEY = 'rpc-lab-output-prefs-v1';

function isAbgAnalysisHidden() {
  return true;
}
function getLabOutputPrefs() {
  try {
    var raw = localStorage.getItem(LAB_OUTPUT_PREFS_KEY);
    var o = raw ? JSON.parse(raw) : {};
    var prefs = {
      showBhExtendedLine: !!o.showBhExtendedLine,
      hideGasoAdvInterp: !!o.hideGasoAdvInterp,
      quickLabOutput: !!o.quickLabOutput,
    };
    if (isAbgAnalysisHidden()) prefs.hideGasoAdvInterp = true;
    return prefs;
  } catch {
    return {
      showBhExtendedLine: false,
      hideGasoAdvInterp: isAbgAnalysisHidden(),
      quickLabOutput: false,
    };
  }
}

function syncAbgLabPrefRowVisibility() {
  var row =
    document.getElementById('lab-pref-gaso-extended')?.closest('label') ||
    document.getElementById('lab-pref-gaso-extended-lbl')?.closest('.lab-pref-row');
  if (row) row.style.display = isAbgAnalysisHidden() ? 'none' : '';
}

function setLabOutputPrefs(partial) {
  var cur = getLabOutputPrefs();
  if (partial.showBhExtendedLine != null) cur.showBhExtendedLine = !!partial.showBhExtendedLine;
  if (partial.hideGasoAdvInterp != null) cur.hideGasoAdvInterp = !!partial.hideGasoAdvInterp;
  if (partial.quickLabOutput != null) cur.quickLabOutput = !!partial.quickLabOutput;
  try {
    localStorage.setItem(LAB_OUTPUT_PREFS_KEY, JSON.stringify(cur));
  } catch (_e) { void _e; }
  return cur;
}

function isGasoInterpretacionResLabChunk(text) {
  var head = String(text || '').split('\n')[0].trim();
  return /^INTERPRETACI[ÓO]N\s+GASOMETR[IÍ]A\s*:/i.test(head);
}

function isAscitisInterpretacionResLabChunk(text) {
  var head = String(text || '').split('\n')[0].trim();
  return /^INTERPRETACI[ÓO]N\s+ASCITIS\s*:/i.test(head);
}

function isCitoquimInterpretacionResLabChunk(text) {
  var head = String(text || '').split('\n')[0].trim();
  return (
    /^INTERPRETACI[ÓO]N\s+CITOQU[IÍ]MICO\s*:/i.test(head) ||
    /^INTERPRETACI[ÓO]N\s+ASCITIS\s*:/i.test(head) ||
    /^INTERPRETACI[ÓO]N\s+PLEURAL\s*:/i.test(head)
  );
}

function citoquimInterpretacionBody_(text) {
  return String(text || '')
    .replace(/^INTERPRETACI[ÓO]N\s+(?:CITOQU[IÍ]MICO|ASCITIS|PLEURAL)\s*:\t?/i, '')
    .trim();
}

function ascitisInterpretacionBody_(text) {
  return citoquimInterpretacionBody_(text);
}

function isBhMainResLabChunk(text) {
  if (!text) return false;
  var head = String(text).split('\n')[0].trim();
  return head.indexOf('BH\t') === 0 || /^BH:?\s*$/.test(head) || /^BH\s/.test(head);
}

function formatBhExtendedTabLine(bhExtras, sourceText) {
  return formatBhExtrasDisplayLine(bhExtras, sourceText || '');
}

function _syncLabPrefSwitchAria(el) {
  if (!el || el.getAttribute('role') !== 'switch') return;
  el.setAttribute('aria-checked', el.checked ? 'true' : 'false');
}

function openLabDisplayPrefsModal() {
  var backdrop = document.getElementById('lab-display-prefs-backdrop');
  if (!backdrop) return;
  syncAbgLabPrefRowVisibility();
  var p = getLabOutputPrefs();
  var cbBh = document.getElementById('lab-pref-bh-extended');
  var cbGaso = document.getElementById('lab-pref-gaso-extended');
  var cbQuick = document.getElementById('lab-pref-quick-output');
  if (cbBh) {
    cbBh.checked = p.showBhExtendedLine;
    _syncLabPrefSwitchAria(cbBh);
  }
  if (cbGaso) {
    cbGaso.checked = !p.hideGasoAdvInterp;
    _syncLabPrefSwitchAria(cbGaso);
  }
  if (cbQuick) {
    cbQuick.checked = p.quickLabOutput;
    _syncLabPrefSwitchAria(cbQuick);
  }
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
}

function closeLabDisplayPrefsModal() {
  var backdrop = document.getElementById('lab-display-prefs-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
}

function onLabDisplayPrefsChanged() {
  var cbBh = document.getElementById('lab-pref-bh-extended');
  var cbGaso = document.getElementById('lab-pref-gaso-extended');
  var cbQuick = document.getElementById('lab-pref-quick-output');
  setLabOutputPrefs({
    showBhExtendedLine: cbBh ? cbBh.checked : false,
    hideGasoAdvInterp: isAbgAnalysisHidden() ? true : cbGaso ? !cbGaso.checked : false,
    quickLabOutput: cbQuick ? cbQuick.checked : false,
  });
  _syncLabPrefSwitchAria(cbBh);
  _syncLabPrefSwitchAria(cbGaso);
  _syncLabPrefSwitchAria(cbQuick);
  rt.rerenderParsedLabOutputAfterPrefsChange();
}

export {
  isAbgAnalysisHidden,
  getLabOutputPrefs,
  setLabOutputPrefs,
  isGasoInterpretacionResLabChunk,
  isCitoquimInterpretacionResLabChunk,
  isAscitisInterpretacionResLabChunk,
  citoquimInterpretacionBody_,
  ascitisInterpretacionBody_,
  isBhMainResLabChunk,
  formatBhExtendedTabLine,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
  syncAbgLabPrefRowVisibility,
};
