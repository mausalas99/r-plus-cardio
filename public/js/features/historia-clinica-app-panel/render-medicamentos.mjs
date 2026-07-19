import {
  ERC_CONDITION_ID,
  syncErcMedicationsToApp,
} from '../../../../lib/historia-clinica/erc-detail.mjs';
import { esc } from './runtime.mjs';
import { emptyHint } from './render-html.mjs';

function medicamentoRowHtml(m, i) {
  const linked = m.linkedFrom === ERC_CONDITION_ID;
  const ro = linked ? ' readonly tabindex="-1" title="Editar en la tarjeta de enfermedad renal crónica"' : '';
  const tag = linked ? ' <span class="hc-tag">ERC</span>' : '';
  return (
    '<div class="hc-entry-row' +
    (linked ? ' hc-entry-row--linked' : '') +
    '" data-medicamento-idx="' +
    i +
    '">' +
    '<div class="field-group"><label>Medicamento' +
    tag +
    '</label>' +
    '<input type="text" data-med-field="medication" value="' +
    esc(m.medication || '') +
    '" placeholder="Nombre genérico o comercial"' +
    ro +
    '></div>' +
    '<div class="field-group"><label>Vía de administración</label>' +
    '<input type="text" data-med-field="route" value="' +
    esc(m.route || '') +
    '" placeholder="VO, IV, SC, inhalada…"' +
    ro +
    '></div>' +
    '<div class="field-group"><label>Dosis</label>' +
    '<input type="text" data-med-field="dosage" value="' +
    esc(m.dosage || '') +
    '" placeholder="ej. 850 mg"' +
    ro +
    '></div>' +
    '<div class="field-group"><label>Frecuencia</label>' +
    '<input type="text" data-med-field="frequency" value="' +
    esc(m.frequency || '') +
    '" placeholder="ej. c/12 h"' +
    ro +
    '></div>' +
    '<button type="button" class="btn-remove" data-medicamento-remove="' +
    i +
    '" aria-label="Quitar">×</button></div>'
  );
}

export function createRenderMedicamentos(ctx, renderers) {
  const { container, app, emit, getErcDetail } = ctx;

  return function renderMedicamentos() {
    const host = container.querySelector('#hc-app-medicamentos');
    if (!host) return;
    const list = app.medicamentosActuales || [];
    if (!list.length) {
      host.innerHTML = emptyHint('Medicamento, vía, dosis y frecuencia de cada fármaco activo.');
      return;
    }
    host.innerHTML = list.map(medicamentoRowHtml).join('');
    host.querySelectorAll('[data-med-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        const row = el.closest('[data-medicamento-idx]');
        const idx = Number(row.getAttribute('data-medicamento-idx'));
        const m = app.medicamentosActuales[idx];
        if (!m || m.linkedFrom === ERC_CONDITION_ID) return;
        m[el.getAttribute('data-med-field')] = el.value;
        emit();
      });
    });
    host.querySelectorAll('[data-medicamento-remove]').forEach(function (btn) {
      btn.onclick = function () {
        const idx = Number(btn.getAttribute('data-medicamento-remove'));
        const m = app.medicamentosActuales[idx];
        if (m && m.linkedFrom === ERC_CONDITION_ID) {
          const erc = getErcDetail();
          erc.medications = erc.medications.filter(function (x) {
            return x.id !== m.id;
          });
          syncErcMedicationsToApp(app);
          renderers.renderErcMeds();
        } else {
          app.medicamentosActuales.splice(idx, 1);
        }
        renderers.renderMedicamentos();
        emit();
      };
    });
  };
}
