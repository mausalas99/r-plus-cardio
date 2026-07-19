import {
  applyUppercaseToHcInput,
  shouldUppercaseHcInput,
} from '../../../lib/historia-clinica/clinical-text.mjs';

/**
 * Wire live uppercase on all Historia Clínica text fields under `root`.
 * @param {HTMLElement | null} root
 */
export function wireClinicalHistoryUppercase(root) {
  if (!root) return;
  root.querySelectorAll('input, textarea').forEach(function (el) {
    if (!shouldUppercaseHcInput(el)) return;
    el.style.textTransform = 'uppercase';
    if (el.dataset.hcUpperWired === '1') return;
    el.dataset.hcUpperWired = '1';
    el.addEventListener('input', function () {
      applyUppercaseToHcInput(el);
    });
  });
}
