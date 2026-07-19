import { syncErcMedicationsToApp } from '../../../../lib/historia-clinica/erc-detail.mjs';
import { esc } from './runtime.mjs';
import { emptyHint } from './render-html.mjs';

export function createRenderErcMeds(ctx, renderers) {
  const { container, app, emit, getErcDetail } = ctx;

  return function renderErcMeds() {
    const host = container.querySelector('#hc-erc-meds-list');
    if (!host) return;
    const erc = getErcDetail();
    const list = erc.medications || [];
    if (!list.length) {
      host.innerHTML = emptyHint('Ej. eritropoyetina, sevelamer, furosemida.');
      return;
    }
    host.innerHTML = list
      .map(function (m, i) {
        return (
          '<div class="hc-entry-row hc-entry-row--compact" data-erc-med-idx="' +
          i +
          '">' +
          '<div class="field-group"><label>Medicamento</label><input type="text" data-erc-med-field="medication" value="' +
          esc(m.medication || '') +
          '"></div>' +
          '<div class="field-group"><label>Vía</label><input type="text" data-erc-med-field="route" value="' +
          esc(m.route || '') +
          '"></div>' +
          '<div class="field-group"><label>Dosis</label><input type="text" data-erc-med-field="dosage" value="' +
          esc(m.dosage || '') +
          '"></div>' +
          '<div class="field-group"><label>Frecuencia</label><input type="text" data-erc-med-field="frequency" value="' +
          esc(m.frequency || '') +
          '"></div>' +
          '<button type="button" class="btn-remove" data-erc-med-remove="' +
          i +
          '" aria-label="Quitar">×</button></div>'
        );
      })
      .join('');
    host.querySelectorAll('[data-erc-med-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        const idx = Number(el.closest('[data-erc-med-idx]').getAttribute('data-erc-med-idx'));
        const key = el.getAttribute('data-erc-med-field');
        erc.medications[idx][key] = el.value;
        syncErcMedicationsToApp(app);
        renderers.renderMedicamentos();
        emit();
      });
    });
    host.querySelectorAll('[data-erc-med-remove]').forEach(function (btn) {
      btn.onclick = function () {
        erc.medications.splice(Number(btn.getAttribute('data-erc-med-remove')), 1);
        syncErcMedicationsToApp(app);
        renderers.renderErcMeds();
        renderers.renderMedicamentos();
        emit();
      };
    });
  };
}

export function createRenderAlergias(ctx) {
  const { container, app, emit } = ctx;

  return function renderAlergias() {
    const host = container.querySelector('#hc-app-alergias-body');
    if (!host) return;
    const list = app.alergiaMedicamentos || [];
    if (!list.length) {
      host.innerHTML = emptyHint('Agrega cada medicamento que causa alergia o reacción.');
      return;
    }
    host.innerHTML = list
      .map(function (row, i) {
        return (
          '<div class="hc-entry-row hc-entry-row--compact" data-alergia-idx="' +
          i +
          '">' +
          '<div class="field-group hc-entry-row-main"><label>Medicamento</label>' +
          '<input type="text" data-al-field="medication" value="' +
          esc(row.medication || '') +
          '" placeholder="ej. Penicilina, AINEs, contraste yodado"></div>' +
          '<button type="button" class="btn-remove" data-alergia-remove="' +
          i +
          '" aria-label="Quitar">×</button></div>'
        );
      })
      .join('');
    host.querySelectorAll('[data-al-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        const row = el.closest('[data-alergia-idx]');
        const idx = Number(row.getAttribute('data-alergia-idx'));
        app.alergiaMedicamentos[idx][el.getAttribute('data-al-field')] = el.value;
        app.alergiasNegado = false;
        emit();
      });
    });
    host.querySelectorAll('[data-alergia-remove]').forEach(function (btn) {
      btn.onclick = function () {
        app.alergiaMedicamentos.splice(Number(btn.getAttribute('data-alergia-remove')), 1);
        renderAlergias();
        emit();
      };
    });
  };
}
