import { cancelOverlayClose, closeOverlayAnimated } from './ui-motion.mjs';

export function ensureGasoExtendedDialog(escHtml, onBackdropClick) {
  var bd = document.getElementById('tend-gaso-ext-backdrop');
  if (bd) return bd;

  bd = document.createElement('div');
  bd.id = 'tend-gaso-ext-backdrop';
  bd.className = 'tend-gaso-ext-backdrop';
  bd.setAttribute('aria-hidden', 'true');
  bd.style.display = 'none';

  bd.innerHTML =
    '<div id="tend-gaso-ext-dialog" class="tend-gaso-ext-dialog" role="dialog" aria-modal="true" aria-labelledby="tend-gaso-ext-title">' +
      '<div class="tend-gaso-ext-header">' +
        '<div class="tend-gaso-ext-header-text">' +
          '<h2 id="tend-gaso-ext-title">' + escHtml('Gasometría extendida') + '</h2>' +
          '<p class="tend-gaso-ext-subtitle">' + escHtml('Último estudio · interpretación ácido-base') + '</p>' +
        '</div>' +
        '<div class="tend-gaso-ext-header-actions">' +
          '<div class="tend-gaso-fio2-chip" role="group" aria-label="Fracción inspirada de oxígeno">' +
            '<span class="tend-gaso-fio2-chip-label">FiO₂</span>' +
            '<input type="number" class="tend-gaso-fio2-input" step="0.01" min="0.08" max="100" inputmode="decimal" aria-label="FiO₂ (0.21 o 21)" title="Fracción 0.21 o porcentaje 21" />' +
            '<span class="tend-gaso-fio2-chip-hint">0.21 · 21%</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="tend-gaso-extended-inner"></div>' +
    '</div>';

  bd.addEventListener('click', function (ev) {
    if (ev.target === bd) onBackdropClick();
  });

  document.body.appendChild(bd);
  return bd;
}

export function closeGasoExtendedBackdrop() {
  var bd = document.getElementById('tend-gaso-ext-backdrop');
  if (!bd) return;
  document.body.classList.remove('tend-gaso-ext-open');
  closeOverlayAnimated(bd, function () {
    bd.style.display = 'none';
  });
}

export function showGasoExtendedBackdrop(bd) {
  cancelOverlayClose(bd);
  bd.style.display = 'flex';
  bd.setAttribute('aria-hidden', 'false');
  document.body.classList.add('tend-gaso-ext-open');
}

export function parseFio2Input(raw, fallback) {
  var n = parseFloat(String(raw == null ? '' : raw).replace(',', '.'));
  if (!isFinite(n)) return fallback;
  if (n > 3) return Math.min(Math.max(n / 100, 0.08), 1);
  return Math.min(Math.max(n, 0.08), 1);
}

export function formatFio2Display(fio2) {
  var asPercent =
    Math.abs(fio2 * 100 - Math.round(fio2 * 100)) < 1e-6 && fio2 <= 1;
  return asPercent ? String(fio2.toFixed(2)) : String(fio2);
}

export function wireGasoExtendedDialog(bd, state, onRerun) {
  var inp = bd.querySelector('.tend-gaso-fio2-input');
  if (!inp || inp._gasoWired) return;
  inp._gasoWired = true;
  inp.value = formatFio2Display(state.gasoExtendedFio2);
  inp.addEventListener('change', onRerun);
  inp.addEventListener('input', onRerun);
}
