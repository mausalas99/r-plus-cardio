import { ensureCardio } from '../../../../lib/cardio/patient-cardio.mjs';
import {
  emptyCongestionChecklist,
  upsertPocusDay,
  getPocusDay,
} from '../../../../lib/cardio/congestion.mjs';
import { saveState } from '../../app-state.mjs';
import { escHtml, escAttr } from '../../dom-escape.mjs';
import { refreshRpcDateFields } from '../../rpc-date-picker.mjs';
import { localYmd, resolveClinicalAsOfYmd } from './descongestion-panel.mjs';

/**
 * @param {boolean | null | undefined} v
 * @param {string} selectedValue '' | '1' | '0'
 */
function triOption(selectedValue, value, label) {
  var sel = String(selectedValue) === String(value) ? ' selected' : '';
  return '<option value="' + escAttr(value) + '"' + sel + '>' + escHtml(label) + '</option>';
}

/**
 * @param {string} name
 * @param {boolean | null | undefined} current
 * @param {string} [id]
 */
export function buildTriStateSelectHtml(name, current, id) {
  var selected = current === true ? '1' : current === false ? '0' : '';
  var idAttr = id ? ' id="' + escAttr(id) + '"' : '';
  return (
    '<select class="ea-input" data-ea-cardio-check="' +
    escAttr(name) +
    '"' +
    idAttr +
    '>' +
    triOption(selected, '', '—') +
    triOption(selected, '1', 'Sí / +') +
    triOption(selected, '0', 'No / −') +
    '</select>'
  );
}

/**
 * @param {string} name
 * @param {string} current
 * @param {Array<[string, string]>} options value/label pairs
 * @param {string} [id]
 */
export function buildNamedSelectHtml(name, current, options, id) {
  var cur = String(current || '');
  var idAttr = id ? ' id="' + escAttr(id) + '"' : '';
  var opts = options
    .map(function (pair) {
      var sel = cur === pair[0] ? ' selected' : '';
      return (
        '<option value="' + escAttr(pair[0]) + '"' + sel + '>' + escHtml(pair[1]) + '</option>'
      );
    })
    .join('');
  return (
    '<select class="ea-input" data-ea-cardio-pocus="' +
    escAttr(name) +
    '"' +
    idAttr +
    '>' +
    opts +
    '</select>'
  );
}

/**
 * @param {{
 *   date: string,
 *   checklist: ReturnType<typeof emptyCongestionChecklist>,
 *   vciCm: number | null,
 *   vciCollapse: string,
 *   vexus: number | null,
 *   congestionScore: number | null,
 *   lungPattern: string,
 *   lungLinesB: string,
 *   stevenson: string,
 *   note: string,
 * }} vm
 */
export function buildCongestionPanelHtml(vm) {
  var cl = vm.checklist || emptyCongestionChecklist();
  var vexusVal = vm.vexus == null ? '' : String(vm.vexus);
  var scoreVal = vm.congestionScore == null ? '' : String(vm.congestionScore);
  var vciVal = vm.vciCm == null ? '' : String(vm.vciCm);

  return (
    '<section class="ea-section ea-card ea-cardio-congestion" data-ea-cardio-congestion-panel="1">' +
    '<h3 class="ea-section-title">Congestión / POCUS</h3>' +
    '<div class="ea-field ea-cardio-day">' +
    '<label class="ea-label" for="ea-cardio-pocus-day">Día</label>' +
    '<input type="date" class="ea-input rpc-date-input" id="ea-cardio-pocus-day" data-ea-cardio-pocus-day value="' +
    escAttr(vm.date || '') +
    '">' +
    '</div>' +
    '<h4 class="ea-snapshot-zone-title">Checklist clínico</h4>' +
    '<div class="ea-cardio-grid ea-cardio-grid--checks">' +
    field('PVY', buildTriStateSelectHtml('pvy', cl.pvy, 'ea-cardio-pvy')) +
    field('RHY', buildTriStateSelectHtml('rhy', cl.rhy, 'ea-cardio-rhy')) +
    field('Soplo', buildTriStateSelectHtml('soplo', cl.soplo, 'ea-cardio-soplo')) +
    field(
      'Detalle soplo',
      '<input type="text" class="ea-input" data-ea-cardio-check-nota="soploNota" value="' +
        escAttr(cl.soploNota || '') +
        '" placeholder="Opcional">'
    ) +
    field('Estertores / derrame', buildTriStateSelectHtml('estertores', cl.estertores, 'ea-cardio-estertores')) +
    field(
      'Detalle estertores',
      '<input type="text" class="ea-input" data-ea-cardio-check-nota="estertoresNota" value="' +
        escAttr(cl.estertoresNota || '') +
        '" placeholder="Opcional">'
    ) +
    field(
      'Ascitis / hepatomegalia',
      buildTriStateSelectHtml('ascitisHepatomegalia', cl.ascitisHepatomegalia, 'ea-cardio-ascitis')
    ) +
    field('Edema MI', buildTriStateSelectHtml('edemaMi', cl.edemaMi, 'ea-cardio-edema')) +
    field(
      'Detalle edema',
      '<input type="text" class="ea-input" data-ea-cardio-check-nota="edemaMiNota" value="' +
        escAttr(cl.edemaMiNota || '') +
        '" placeholder="Grado / texto">'
    ) +
    field(
      'Llenado capilar',
      buildNamedSelectHtml(
        'llenadoCapilar',
        cl.llenadoCapilar || '',
        [
          ['', '—'],
          ['<2s', '< 2 s'],
          ['2-3s', '2–3 s'],
          ['>3s', '> 3 s'],
          ['otro', 'Otro'],
        ],
        'ea-cardio-llenado'
      )
    ) +
    '</div>' +
    '<h4 class="ea-snapshot-zone-title">POCUS</h4>' +
    '<div class="ea-cardio-grid">' +
    field(
      'VCI (cm)',
      '<input type="number" class="ea-input" data-ea-cardio-pocus="vciCm" step="0.01" min="0" value="' +
        escAttr(vciVal) +
        '">'
    ) +
    field(
      'Colapso VCI',
      buildNamedSelectHtml(
        'vciCollapse',
        vm.vciCollapse || '',
        [
          ['', '—'],
          ['<50%', '< 50%'],
          ['≥50%', '≥ 50%'],
          ['completo', 'Completo'],
          ['no valorable', 'No valorable'],
        ]
      )
    ) +
    field(
      'VExUS',
      buildNamedSelectHtml(
        'vexus',
        vexusVal,
        [
          ['', '—'],
          ['0', '0'],
          ['1', '1'],
          ['2', '2'],
          ['3', '3'],
        ]
      )
    ) +
    field(
      'Score de congestión',
      '<input type="number" class="ea-input" data-ea-cardio-pocus="congestionScore" step="1" min="0" value="' +
        escAttr(scoreVal) +
        '">'
    ) +
    field(
      'Patrón pulmonar',
      buildNamedSelectHtml(
        'lungPattern',
        vm.lungPattern || '',
        [
          ['', '—'],
          ['A', 'A'],
          ['B', 'B'],
        ]
      )
    ) +
    field(
      'Líneas B',
      buildNamedSelectHtml(
        'lungLinesB',
        vm.lungLinesB || '',
        [
          ['', '—'],
          ['escasas', 'Escasas'],
          ['moderadas', 'Moderadas'],
          ['difusas', 'Difusas'],
        ]
      )
    ) +
    field(
      'Stevenson',
      buildNamedSelectHtml(
        'stevenson',
        vm.stevenson || '',
        [
          ['', '—'],
          ['A', 'A'],
          ['B', 'B'],
          ['C', 'C'],
          ['L', 'L'],
        ]
      )
    ) +
    '</div>' +
    '<div class="ea-field">' +
    '<label class="ea-label" for="ea-cardio-pocus-note">Nota POCUS (opcional)</label>' +
    '<textarea class="ea-input ea-cardio-note" id="ea-cardio-pocus-note" data-ea-cardio-pocus="note" rows="2" placeholder="Libre si los selectores no alcanzan">' +
    escHtml(vm.note || '') +
    '</textarea>' +
    '</div>' +
    '<div class="ea-cardio-actions">' +
    '<button type="button" class="ea-btn ea-btn--success" data-ea-cardio-pocus-save>Guardar congestión / POCUS</button>' +
    '</div>' +
    '</section>'
  );
}

/**
 * @param {string} label
 * @param {string} controlHtml
 */
function field(label, controlHtml) {
  return (
    '<div class="ea-field">' +
    '<span class="ea-label">' +
    escHtml(label) +
    '</span>' +
    controlHtml +
    '</div>'
  );
}

/**
 * Normalize checklist keys from fixtures / older blobs.
 * @param {Record<string, unknown> | null | undefined} raw
 */
export function normalizeCongestionChecklist(raw) {
  var base = emptyCongestionChecklist();
  if (!raw || typeof raw !== 'object') return base;
  Object.assign(base, raw);
  if (base.ascitisHepatomegalia == null && raw.ascitis != null) {
    base.ascitisHepatomegalia = /** @type {boolean|null} */ (raw.ascitis);
  }
  base.llenadoCapilar = normalizeLlenadoCapilar(base.llenadoCapilar);
  return base;
}

/**
 * Map legacy digit / free-text capillary refill into UI select values.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeLlenadoCapilar(raw) {
  var s = String(raw || '').trim();
  if (!s) return '';
  if (s === '<2s' || s === '2-3s' || s === '>3s' || s === 'otro') return s;
  if (s === '1' || s === '2' || /^<\s*2/i.test(s)) return '<2s';
  if (s === '3' || /^2\s*[-–]\s*3/i.test(s)) return '2-3s';
  if (s === '4' || s === '5' || /^>\s*3/i.test(s)) return '>3s';
  return 'otro';
}

/**
 * @param {HTMLElement | null} mount
 * @param {Record<string, unknown> | null | undefined} patient
 * @param {{ day?: string }} [opts]
 */
export function mountCongestionPanel(mount, patient, opts) {
  if (!mount || !patient) return;
  ensureCardio(patient);
  /** @type {any} */
  var cardio = patient.cardio;
  var day =
    (opts && opts.day) ||
    resolveClinicalAsOfYmd(patient) ||
    localYmd();
  var existing = getPocusDay(cardio.pocusByDay, day);
  var checklist = normalizeCongestionChecklist(existing && existing.checklist);
  mount.innerHTML = buildCongestionPanelHtml({
    date: day,
    checklist: checklist,
    vciCm: existing ? existing.vciCm : null,
    vciCollapse: existing ? existing.vciCollapse : '',
    vexus: existing ? existing.vexus : null,
    congestionScore: existing ? existing.congestionScore : null,
    lungPattern: existing ? existing.lungPattern : '',
    lungLinesB: existing ? existing.lungLinesB : '',
    stevenson: existing ? existing.stevenson : '',
    note: existing ? existing.note : '',
  });
  wireCongestionPanel(mount, patient);
  refreshRpcDateFields(mount);
}

/**
 * @param {HTMLElement} mount
 * @param {Record<string, unknown>} patient
 */
function wireCongestionPanel(mount, patient) {
  var dayEl = mount.querySelector('[data-ea-cardio-pocus-day]');
  if (dayEl) {
    dayEl.addEventListener('change', function () {
      var day = String(dayEl.value || '').trim() || localYmd();
      mountCongestionPanel(mount, patient, { day: day });
    });
  }

  var saveBtn = mount.querySelector('[data-ea-cardio-pocus-save]');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      persistCongestionFromForm(mount, patient);
    });
  }
}

/**
 * @param {string} raw
 * @returns {boolean | null}
 */
export function parseTriStateValue(raw) {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

/**
 * @param {HTMLElement} mount
 * @param {Record<string, unknown>} patient
 */
function persistCongestionFromForm(mount, patient) {
  ensureCardio(patient);
  /** @type {any} */
  var cardio = patient.cardio;
  var dayEl = mount.querySelector('[data-ea-cardio-pocus-day]');
  var day = String((dayEl && dayEl.value) || '').trim() || localYmd();

  var checklist = emptyCongestionChecklist();
  mount.querySelectorAll('[data-ea-cardio-check]').forEach(function (el) {
    var key = el.getAttribute('data-ea-cardio-check');
    if (!key || !(key in checklist)) return;
    checklist[key] = parseTriStateValue(el.value);
  });
  mount.querySelectorAll('[data-ea-cardio-check-nota]').forEach(function (el) {
    var key = el.getAttribute('data-ea-cardio-check-nota');
    if (!key) return;
    checklist[key] = String(el.value || '').trim();
  });
  var llenadoEl = mount.querySelector('[data-ea-cardio-pocus="llenadoCapilar"]');
  if (llenadoEl) checklist.llenadoCapilar = String(llenadoEl.value || '').trim();

  /** @type {Record<string, unknown>} */
  var pocus = {
    date: day,
    checklist: checklist,
    vciCm: null,
    vciCollapse: '',
    vexus: null,
    congestionScore: null,
    lungPattern: '',
    lungLinesB: '',
    stevenson: '',
    note: '',
  };

  mount.querySelectorAll('[data-ea-cardio-pocus]').forEach(function (el) {
    var key = el.getAttribute('data-ea-cardio-pocus');
    if (!key || key === 'llenadoCapilar') return;
    var raw = String(el.value || '').trim();
    if (key === 'vciCm' || key === 'vexus' || key === 'congestionScore') {
      if (raw === '') {
        pocus[key] = null;
      } else {
        var n = Number(raw);
        pocus[key] = Number.isFinite(n) ? n : null;
      }
      return;
    }
    pocus[key] = raw;
  });

  cardio.pocusByDay = upsertPocusDay(cardio.pocusByDay, pocus);
  saveState();
  mountCongestionPanel(mount, patient, { day: day });
}
