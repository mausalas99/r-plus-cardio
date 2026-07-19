import { buildProximaCitaText } from '../receta-hu-core.mjs';
import { esc, consultServices } from './receta-hu-shared.mjs';

export function renderMedList(root, meds) {
  var list = root.querySelector('#receta-hu-meds-list');
  if (!list) return;
  if (!meds.length) {
    list.innerHTML = '<p class="receta-hu-list-empty">Sin medicamentos aún.</p>';
    return;
  }
  list.innerHTML = meds
    .map(function (row, idx) {
      return (
        '<div class="receta-hu-item" data-med-idx="' +
        idx +
        '">' +
        '<div class="receta-hu-item-body">' +
        '<strong>' +
        esc(row.medicamento || '—') +
        '</strong>' +
        (row.presentacion ? '<span>' + esc(row.presentacion) + '</span>' : '') +
        (row.dosis ? '<span class="receta-hu-item-dose">' + esc(row.dosis) + '</span>' : '') +
        '</div>' +
        '<button type="button" class="btn-icon-quiet" title="Quitar" aria-label="Quitar medicamento" data-receta-hu-action="remove-med" data-med-idx="' +
        idx +
        '">×</button>' +
        '</div>'
      );
    })
    .join('');
}

export function renderLabList(root, labs) {
  var list = root.querySelector('#receta-hu-labs-added');
  if (!list) return;
  var items = labs.filter(function (x) {
    return String(x || '').trim();
  });
  if (!items.length) {
    list.innerHTML = '<p class="receta-hu-list-empty">Sin estudios aún.</p>';
    return;
  }
  list.innerHTML = items
    .map(function (name, idx) {
      return (
        '<div class="receta-hu-item receta-hu-item-lab" data-lab-idx="' +
        idx +
        '">' +
        '<span class="receta-hu-item-body">' +
        esc(name) +
        '</span>' +
        '<button type="button" class="btn-icon-quiet" title="Quitar" aria-label="Quitar estudio" data-receta-hu-action="remove-lab" data-lab-idx="' +
        idx +
        '">×</button>' +
        '</div>'
      );
    })
    .join('');
}

export function renderProximaCitaList(root, proximasCitas) {
  var list = root.querySelector('#receta-hu-proximas-list');
  if (!list) return;
  var items = (proximasCitas || []).filter(function (row) {
    return row && (row.texto || row.servicio || row.fecha);
  });
  if (!items.length) {
    list.innerHTML = '<p class="receta-hu-list-empty">Sin consultas de seguimiento aún.</p>';
    return;
  }
  list.innerHTML = items
    .map(function (row, idx) {
      var meta = [];
      if (row.fecha) meta.push('Fecha: ' + row.fecha);
      if (row.servicio && !row.texto) meta.push(row.servicio);
      return (
        '<div class="receta-hu-item receta-hu-item-proxima" data-proxima-idx="' +
        idx +
        '">' +
        '<div class="receta-hu-item-body">' +
        '<strong>' +
        esc(row.texto || buildProximaCitaText(row.plazo, row.servicio) || '—') +
        '</strong>' +
        (meta.length ? '<span class="receta-hu-item-dose">' + esc(meta.join(' · ')) + '</span>' : '') +
        '</div>' +
        '<button type="button" class="btn-icon-quiet" title="Quitar" aria-label="Quitar consulta" data-receta-hu-action="remove-proxima" data-proxima-idx="' +
        idx +
        '">×</button>' +
        '</div>'
      );
    })
    .join('');
}

export function renderConsultServiceSelect(root, draft) {
  var sel = root.querySelector('#receta-hu-consult-servicio');
  if (!sel) return;
  var services = consultServices();
  var prev = sel.value;
  sel.innerHTML = '<option value="">— Servicio —</option>';
  services.forEach(function (s) {
    var opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });
  if (prev && services.indexOf(prev) >= 0) sel.value = prev;
  var plazo = root.querySelector('#receta-hu-compose-proxima-plazo');
  if (plazo && draft.proximaPlazo) plazo.value = draft.proximaPlazo;
}
