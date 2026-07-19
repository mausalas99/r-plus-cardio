import { esc } from './runtime.mjs';
import { emptyHint } from './render-html.mjs';
import { flexibleDateHtml, readFlexibleDate } from './flex-date.mjs';
import { wireEntryList } from './entry-list-wire.mjs';

export function createRenderCirugias(ctx) {
  const { container, app, emit } = ctx;

  return function renderCirugias() {
    const host = container.querySelector('#hc-app-cirugias');
    if (!host) return;
    const list = app.cirugias || [];
    if (!list.length) {
      host.innerHTML = emptyHint('Procedimiento, fecha y complicaciones si aplica.');
      return;
    }
    host.innerHTML = list
      .map(function (c, i) {
        return (
          '<div class="hc-entry-row" data-cirugia-idx="' +
          i +
          '">' +
          '<div class="field-group"><label>Procedimiento</label><input type="text" data-c-field="procedure" value="' +
          esc(c.procedure || '') +
          '"></div>' +
          '<div class="field-group"><label>Fecha</label>' +
          flexibleDateHtml('cir-' + i, c.date) +
          '</div>' +
          '<div class="field-group hc-entry-row-span"><label>Complicaciones</label><input type="text" data-c-field="complications" value="' +
          esc(c.complications || '') +
          '"></div>' +
          '<button type="button" class="btn-remove" data-cirugia-remove="' +
          i +
          '" aria-label="Quitar">×</button></div>'
        );
      })
      .join('');
    wireEntryList(
      host,
      app.cirugias,
      'cirugia',
      'c-field',
      function (idx, wrap) {
        app.cirugias[idx].date = readFlexibleDate(wrap);
      },
      emit,
      renderCirugias
    );
  };
}

export function createRenderHosps(ctx) {
  const { container, app, emit } = ctx;

  return function renderHosps() {
    const host = container.querySelector('#hc-app-hospitalizaciones');
    if (!host) return;
    const list = app.hospitalizaciones || [];
    if (!list.length) {
      host.innerHTML = emptyHint('Motivo, fecha, duración y complicaciones.');
      return;
    }
    host.innerHTML = list
      .map(function (h, i) {
        return (
          '<div class="hc-entry-row" data-hosp-idx="' +
          i +
          '">' +
          '<div class="field-group"><label>Motivo</label><input type="text" data-h-field="reason" value="' +
          esc(h.reason || '') +
          '"></div>' +
          '<div class="field-group"><label>Fecha</label>' +
          flexibleDateHtml('hos-' + i, h.date) +
          '</div>' +
          '<div class="field-group"><label>Duración</label><input type="text" data-h-field="duration" value="' +
          esc(h.duration || '') +
          '" placeholder="ej. 5 días"></div>' +
          '<div class="field-group"><label>Complicaciones</label><input type="text" data-h-field="complications" value="' +
          esc(h.complications || '') +
          '"></div>' +
          '<button type="button" class="btn-remove" data-hosp-remove="' +
          i +
          '" aria-label="Quitar">×</button></div>'
        );
      })
      .join('');
    wireEntryList(
      host,
      app.hospitalizaciones,
      'hosp',
      'h-field',
      function (idx, wrap) {
        app.hospitalizaciones[idx].date = readFlexibleDate(wrap);
      },
      emit,
      renderHosps
    );
  };
}
