import { patchReviewStep, reviewStepHint } from '../../../../lib/drive-import/drive-import-review.mjs';
import { driveImportState } from './drive-import-state.mjs';

import { escapeHtml } from '../../dom-escape.mjs';
export function formatEvDate(iso) {
  if (!iso) return 'sin fecha';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'sin fecha';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return dd + '/' + mm + '/' + yy;
}

export function readStructuredSuggestionsFromUi() {
  /** @type {Array<{ include?: boolean }>} */
  const rows = [];
  document.querySelectorAll('[data-drive-struct-idx]').forEach(function (row) {
    const idx = Number(row.getAttribute('data-drive-struct-idx'));
    const cb = row.querySelector('input[type="checkbox"]');
    rows[idx] = { include: cb ? cb.checked : true };
  });
  return rows;
}

export function syncCurrentReviewStepFromUi() {
  const step = driveImportState.reviewSteps[driveImportState.reviewIndex];
  if (!step) return;
  const includeEl = /** @type {HTMLInputElement | null} */ (
    document.getElementById('drive-import-review-include')
  );
  const editor = /** @type {HTMLTextAreaElement | null} */ (
    document.getElementById('drive-import-review-editor')
  );

  if (step.kind === 'hc') {
    patchReviewStep(step, {
      include: includeEl ? includeEl.checked : true,
      editText: editor ? editor.value : step.editText,
      structuredSuggestions: readStructuredSuggestionsFromUi(),
    });
    return;
  }
  if (step.kind === 'header') {
    patchReviewStep(step, { include: includeEl ? includeEl.checked : true });
    return;
  }
  if (step.kind === 'eventos') {
    syncEventosStepFromUi(step);
    return;
  }
  if (step.kind === 'labs') {
    syncLabsStepFromUi(step);
  }
}

function syncEventosStepFromUi(step) {
  const rows = document.querySelectorAll('[data-drive-ev-idx]');
  /** @type {Array<{ include?: boolean, text?: string }>} */
  const entries = [];
  rows.forEach(function (row) {
    const idx = Number(row.getAttribute('data-drive-ev-idx'));
    const cb = row.querySelector('input[type="checkbox"]');
    const ta = row.querySelector('textarea');
    entries[idx] = {
      include: cb ? cb.checked : true,
      text: ta ? ta.value : '',
    };
  });
  patchReviewStep(step, { entries: entries });
}

function syncLabsStepFromUi(step) {
  const rows = document.querySelectorAll('[data-drive-lab-idx]');
  /** @type {Array<{ include?: boolean }>} */
  const sets = [];
  rows.forEach(function (row) {
    const idx = Number(row.getAttribute('data-drive-lab-idx'));
    const cb = row.querySelector('input[type="checkbox"]');
    sets[idx] = { include: cb ? cb.checked : true };
  });
  patchReviewStep(step, { sets: sets });
}

function renderReviewDots(onSelect) {
  const dots = document.getElementById('drive-import-review-dots');
  if (!dots) return;
  dots.innerHTML = '';
  driveImportState.reviewSteps.forEach(function (step, idx) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'drive-import-review-dot' + (idx === driveImportState.reviewIndex ? ' is-active' : '');
    btn.title = step.label;
    btn.setAttribute(
      'aria-label',
      step.label + ' (' + (idx + 1) + ' de ' + driveImportState.reviewSteps.length + ')'
    );
    btn.setAttribute('aria-current', idx === driveImportState.reviewIndex ? 'step' : 'false');
    btn.addEventListener('click', function () {
      syncCurrentReviewStepFromUi();
      onSelect(idx);
    });
    dots.appendChild(btn);
  });
}

function renderStructuredSuggestions(step) {
  const host = document.getElementById('drive-import-review-structured');
  if (!host) return;
  const suggestions = step.structuredSuggestions || [];
  if (!suggestions.length) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }
  host.hidden = false;
  let html =
    '<div class="drive-import-structured-head">Campos detectados — marcar para agregar a casillas estructuradas</div>' +
    '<div class="drive-import-structured-list">';
  suggestions.forEach(function (s, idx) {
    html +=
      '<label class="drive-import-structured-row" data-drive-struct-idx="' +
      idx +
      '">' +
      '<input type="checkbox"' +
      (s.include !== false ? ' checked' : '') +
      ' aria-label="' +
      escapeHtml(s.label) +
      '" />' +
      '<span class="drive-import-structured-label">' +
      escapeHtml(s.label) +
      '</span></label>';
  });
  html += '</div>';
  host.innerHTML = html;
}

function hideStructuredSuggestions() {
  const structHost = document.getElementById('drive-import-review-structured');
  if (structHost) {
    structHost.hidden = true;
    structHost.innerHTML = '';
  }
}

function renderReviewStepShell(step) {
  const progress = document.getElementById('drive-import-review-progress');
  const titleEl = document.getElementById('drive-import-review-title');
  const hintEl = document.getElementById('drive-import-review-hint');
  const nextBtn = document.getElementById('drive-import-review-next');
  const prevBtn = document.getElementById('drive-import-review-prev');

  if (progress) {
    progress.textContent =
      'Sección ' +
      (driveImportState.reviewIndex + 1) +
      ' de ' +
      driveImportState.reviewSteps.length +
      ' · ' +
      step.label;
  }
  if (titleEl) titleEl.textContent = step.label;
  if (hintEl) hintEl.textContent = reviewStepHint(step);
  if (prevBtn) prevBtn.disabled = driveImportState.reviewIndex <= 0;
  if (nextBtn) {
    nextBtn.textContent =
      driveImportState.reviewIndex >= driveImportState.reviewSteps.length - 1
        ? 'Importar lo aprobado'
        : 'Siguiente sección';
  }
}

function setReviewEditorVisibility(isList, isHeader) {
  const includeWrap = document.getElementById('drive-import-review-include-wrap');
  const editor = /** @type {HTMLTextAreaElement | null} */ (
    document.getElementById('drive-import-review-editor')
  );
  const listEl = document.getElementById('drive-import-review-list');
  if (includeWrap) includeWrap.hidden = isList;
  if (editor) {
    editor.hidden = isList || isHeader;
    editor.style.display = isList || isHeader ? 'none' : '';
  }
  if (listEl) listEl.hidden = !isList && !isHeader;
}

function renderHcStep(step) {
  const includeEl = /** @type {HTMLInputElement | null} */ (
    document.getElementById('drive-import-review-include')
  );
  const editor = /** @type {HTMLTextAreaElement | null} */ (
    document.getElementById('drive-import-review-editor')
  );
  if (!includeEl || !editor) return;
  includeEl.checked = step.include;
  editor.value = step.editText;
  editor.readOnly = false;
  renderStructuredSuggestions(step);
}

function renderHeaderStep(step) {
  const includeEl = /** @type {HTMLInputElement | null} */ (
    document.getElementById('drive-import-review-include')
  );
  const listEl = document.getElementById('drive-import-review-list');
  if (!includeEl || !listEl) return;
  includeEl.checked = step.include;
  const h = step.header || {};
  const bits = [];
  if (h.nombre) bits.push('Nombre: ' + h.nombre);
  if (h.registro) bits.push('Registro: ' + h.registro);
  if (h.edad) bits.push('Edad: ' + h.edad);
  if (h.cama) bits.push('Cama: ' + h.cama);
  if (h.sexo) bits.push('Sexo: ' + h.sexo);
  listEl.hidden = false;
  listEl.innerHTML =
    '<pre class="drive-import-review-header-pre">' + escapeHtml(bits.join('\n')) + '</pre>';
}

function renderEventosStep(step) {
  const listEl = document.getElementById('drive-import-review-list');
  if (!listEl) return;
  listEl.hidden = false;
  let html = '';
  step.entries.forEach(function (entry, idx) {
    const date = formatEvDate(entry.at);
    html +=
      '<div class="drive-import-review-row" data-drive-ev-idx="' +
      idx +
      '">' +
      '<label class="drive-import-review-row-check">' +
      '<input type="checkbox"' +
      (entry.include ? ' checked' : '') +
      ' aria-label="Incluir eventualidad ' +
      (idx + 1) +
      '" />' +
      '<span class="drive-import-review-row-date">' +
      escapeHtml(date) +
      '</span></label>' +
      '<textarea class="drive-import-review-row-text" rows="3" spellcheck="true">' +
      escapeHtml(entry.text) +
      '</textarea></div>';
  });
  listEl.innerHTML = html;
}

function renderLabsStep(step) {
  const listEl = document.getElementById('drive-import-review-list');
  if (!listEl) return;
  listEl.hidden = false;
  let html =
    '<div class="drive-import-labs-table-wrap"><table class="drive-import-labs-table"><thead><tr>' +
    '<th scope="col" class="drive-import-labs-col-check">Incluir</th>' +
    '<th scope="col">Fecha</th><th scope="col">Paneles</th><th scope="col">Estado</th>' +
    '</tr></thead><tbody>';
  step.sets.forEach(function (set, idx) {
    const panels = escapeHtml(String(set.summary || '').replace(/^[^—]+—\s*/, ''));
    const statusClass = set.isDuplicate
      ? 'drive-import-lab-status drive-import-lab-status--dup'
      : 'drive-import-lab-status drive-import-lab-status--new';
    const statusText = set.isDuplicate ? 'En historial' : 'Nueva';
    html +=
      '<tr class="drive-import-labs-row' +
      (set.isDuplicate ? ' is-duplicate' : '') +
      '" data-drive-lab-idx="' +
      idx +
      '">' +
      '<td class="drive-import-labs-col-check"><input type="checkbox"' +
      (set.include ? ' checked' : '') +
      ' aria-label="Incluir laboratorio ' +
      escapeHtml(set.fecha || '') +
      '" /></td>' +
      '<td class="drive-import-labs-fecha">' +
      escapeHtml(set.fecha || '') +
      '</td>' +
      '<td class="drive-import-labs-panels">' +
      panels +
      '</td>' +
      '<td><span class="' +
      statusClass +
      '">' +
      statusText +
      '</span></td></tr>';
  });
  html += '</tbody></table></div>';
  listEl.innerHTML = html;
}

export function renderReviewStep() {
  const step = driveImportState.reviewSteps[driveImportState.reviewIndex];
  if (!step) return;

  renderReviewStepShell(step);
  renderReviewDots(function (idx) {
    driveImportState.reviewIndex = idx;
    renderReviewStep();
  });

  const isList = step.kind === 'eventos' || step.kind === 'labs';
  const isHeader = step.kind === 'header';
  setReviewEditorVisibility(isList, isHeader);

  if (step.kind === 'hc') {
    renderHcStep(step);
    return;
  }

  if (isList || isHeader) hideStructuredSuggestions();

  if (step.kind === 'header') {
    renderHeaderStep(step);
    return;
  }
  if (step.kind === 'eventos') {
    renderEventosStep(step);
    return;
  }
  if (step.kind === 'labs') {
    renderLabsStep(step);
  }
}
