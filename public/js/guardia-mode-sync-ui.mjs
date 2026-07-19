/** Guardia mode DOM + board rerender helpers (extracted for complexity budget). */

const GUARDIA_MODE_LABEL_OFF = 'Alcance completo';
const GUARDIA_MODE_LABEL_ON = 'Solo mis entregas';
const GUARDIA_MODE_TOGGLE_TITLE =
  'Filtro de la grilla: pacientes en tu alcance o solo los que te entregaron (independiente del botón Entrega).';
const GUARDIA_CENSUS_FILTER_HINT_ON = 'Solo pacientes que te entregaron en este turno.';
const GUARDIA_CENSUS_FILTER_HINT_OFF = 'Todos los pacientes en tu alcance clínico.';

export function syncGuardiaModeDom(active) {
  if (typeof document === 'undefined') return;
  const boardBtn = document.getElementById('btn-guardia-mode-toggle');
  if (boardBtn) {
    boardBtn.setAttribute('aria-pressed', String(active));
    boardBtn.setAttribute('title', GUARDIA_MODE_TOGGLE_TITLE);
    boardBtn.setAttribute(
      'aria-label',
      `${active ? GUARDIA_CENSUS_FILTER_HINT_ON : GUARDIA_CENSUS_FILTER_HINT_OFF} ${active ? GUARDIA_MODE_LABEL_ON : GUARDIA_MODE_LABEL_OFF}`
    );
    boardBtn.classList.toggle('is-active', active);
    const label = boardBtn.querySelector('.guardia-mode-label');
    if (label) label.textContent = active ? GUARDIA_MODE_LABEL_ON : GUARDIA_MODE_LABEL_OFF;
  }
  const filterHint = document.getElementById('guardia-census-filter-hint');
  if (filterHint) {
    filterHint.textContent = active ? GUARDIA_CENSUS_FILTER_HINT_ON : GUARDIA_CENSUS_FILTER_HINT_OFF;
  }
}

export function rerenderGuardiaBoardIfRequested(opts) {
  if (!opts.rerenderBoard) return;
  const render = opts.renderGuardiaBoard;
  if (typeof render === 'function') {
    render(opts.settings);
    return;
  }
  if (typeof globalThis.renderGuardiaBoard !== 'function') return;
  let settings = opts.settings;
  if (!settings) {
    try {
      settings = JSON.parse(localStorage.getItem('rpc-settings') || '{}');
    } catch {
      settings = {};
    }
  }
  globalThis.renderGuardiaBoard(settings);
}
