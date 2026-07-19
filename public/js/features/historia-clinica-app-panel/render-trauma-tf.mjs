import { esc } from './runtime.mjs';
import { emptyHint } from './render-html.mjs';
import { flexibleDateHtml, readFlexibleDate, wireFlexibleDate } from './flex-date.mjs';

export function createRenderTrauma(ctx) {
  const { container, app, emit } = ctx;

  return function renderTrauma() {
    const host = container.querySelector('#hc-app-trauma-body');
    if (!host) return;
    const list = app.traumaticosEntries || [];
    if (!list.length) {
      host.innerHTML = emptyHint('Fracturas, politraumatismos u otros eventos con fecha aproximada.');
      return;
    }
    host.innerHTML = list
      .map(function (t, i) {
        return (
          '<div class="hc-entry-row" data-trauma-idx="' +
          i +
          '">' +
          '<div class="field-group"><label>Fecha</label>' +
          flexibleDateHtml('tr-' + i, t.date) +
          '</div>' +
          '<div class="field-group hc-entry-row-main"><label>Qué ocurrió</label>' +
          '<input type="text" data-tr-field="description" value="' +
          esc(t.description || '') +
          '" placeholder="ej. Fractura de fémur por caída"></div>' +
          '<button type="button" class="btn-remove" data-trauma-remove="' +
          i +
          '" aria-label="Quitar">×</button></div>'
        );
      })
      .join('');
    host.querySelectorAll('.hc-flex-date').forEach(wireFlexibleDate);
    host.querySelectorAll('[data-tr-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        const idx = Number(el.closest('[data-trauma-idx]').getAttribute('data-trauma-idx'));
        app.traumaticosEntries[idx][el.getAttribute('data-tr-field')] = el.value;
        emit();
      });
    });
    host.querySelectorAll('[data-trauma-remove]').forEach(function (btn) {
      btn.onclick = function () {
        app.traumaticosEntries.splice(Number(btn.getAttribute('data-trauma-remove')), 1);
        renderTrauma();
        emit();
      };
    });
    host.querySelectorAll('.hc-flex-date').forEach(function (wrap) {
      wrap.querySelectorAll('input,select').forEach(function (el) {
        el.addEventListener('change', function () {
          const idx = Number(wrap.closest('[data-trauma-idx]').getAttribute('data-trauma-idx'));
          app.traumaticosEntries[idx].date = readFlexibleDate(wrap);
          emit();
        });
      });
    });
  };
}

export function createRenderTransfusiones(ctx) {
  const { container, app, emit } = ctx;

  return function renderTransfusiones() {
    const host = container.querySelector('#hc-app-transfusion-body');
    if (!host) return;
    const list = app.transfusionesEntries || [];
    if (!list.length) {
      host.innerHTML = emptyHint('Número de unidades, fecha y reacciones adversas si hubo.');
      return;
    }
    host.innerHTML = list
      .map(function (t, i) {
        return (
          '<div class="hc-entry-row" data-transfusion-idx="' +
          i +
          '">' +
          '<div class="field-group"><label>Unidades / cantidad</label>' +
          '<input type="text" data-tf-field="units" value="' +
          esc(t.units != null ? t.units : '') +
          '" placeholder="ej. 2 paquetes globulares"></div>' +
          '<div class="field-group"><label>Fecha</label>' +
          flexibleDateHtml('tf-' + i, t.date) +
          '</div>' +
          '<div class="field-group hc-entry-row-span"><label>Reacciones adversas</label>' +
          '<input type="text" data-tf-field="adverseReactions" value="' +
          esc(t.adverseReactions || '') +
          '" placeholder="Ninguna, o describir"></div>' +
          '<button type="button" class="btn-remove" data-transfusion-remove="' +
          i +
          '" aria-label="Quitar">×</button></div>'
        );
      })
      .join('');
    host.querySelectorAll('.hc-flex-date').forEach(wireFlexibleDate);
    host.querySelectorAll('[data-tf-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        const idx = Number(el.closest('[data-transfusion-idx]').getAttribute('data-transfusion-idx'));
        app.transfusionesEntries[idx][el.getAttribute('data-tf-field')] = el.value;
        emit();
      });
    });
    host.querySelectorAll('[data-transfusion-remove]').forEach(function (btn) {
      btn.onclick = function () {
        app.transfusionesEntries.splice(Number(btn.getAttribute('data-transfusion-remove')), 1);
        renderTransfusiones();
        emit();
      };
    });
    host.querySelectorAll('.hc-flex-date').forEach(function (wrap) {
      wrap.querySelectorAll('input,select').forEach(function (el) {
        el.addEventListener('change', function () {
          const idx = Number(wrap.closest('[data-transfusion-idx]').getAttribute('data-transfusion-idx'));
          app.transfusionesEntries[idx].date = readFlexibleDate(wrap);
          emit();
        });
      });
    });
  };
}
