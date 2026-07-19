import { escapeHtml } from '../../dom-escape.mjs';
// Entrega pendientes — procedures list + add form
import {
  canDeletePendienteItem,
  createProcedimientoItem,
  pendingRequirementBadges,
} from '../../../../lib/entrega/entrega-pendientes.mjs';
import { entregaDraft, entregaUiFlags } from './entrega-modal-state.mjs';
import { formatHHmm, scheduledAtFromTimeInput, buildTimeSelectMarkup, readTimeFromForm } from './entrega-modal-time.mjs';
import { checkPill } from './entrega-modal-handoff.mjs';

const BADGE_LABELS = {
  consentimiento: 'Consent',
  anestesia: 'Anest',
  familiar: 'Familiar',
};

function toast(msg, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(msg, type);
  }
}

function renderBadgeChips(item) {
  const badges = pendingRequirementBadges(item);
  if (!badges.length) return '';
  return badges
    .map(
      (b) =>
        `<span class="entrega-proc-chip entrega-proc-chip--req">${escapeHtml(BADGE_LABELS[b] || b)}</span>`
    )
    .join('');
}

function renderStatusChips(item) {
  const chips = [];
  if (item.comentado) chips.push('<span class="entrega-proc-chip">Comentado</span>');
  if (item.autorizado) chips.push('<span class="entrega-proc-chip">Autorizado</span>');
  if (item.agendado) chips.push('<span class="entrega-proc-chip">Agendado</span>');
  if (item.lockedBase) chips.push('<span class="entrega-proc-chip entrega-proc-chip--lock">Base</span>');
  return chips.join('');
}

function ensureProcDetailsOpen() {
  const details = document.querySelector('#entrega-modal-backdrop .entrega-proc-details');
  if (details instanceof HTMLDetailsElement && !details.open) details.open = true;
}

function renderProcList() {
  const list = document.getElementById('entrega-proc-list');
  if (!list || !entregaDraft.actor) return;

  if (entregaDraft.items.length) ensureProcDetailsOpen();

  if (!entregaDraft.items.length) {
    list.innerHTML = '<li class="entrega-proc-empty">Sin procedimientos. Usa + Agregar.</li>';
    return;
  }

  list.innerHTML = entregaDraft.items
    .map((item) => {
      if (item.type === 'legacy_text') {
        const canDel = canDeletePendienteItem(item, entregaDraft.actor);
        return `<li class="entrega-proc-card entrega-proc-card--legacy" data-item-id="${escapeHtml(item.id)}">
          <div class="entrega-proc-card-main">
            <span class="entrega-proc-label">${escapeHtml(item.text || '')}</span>
            <span class="entrega-proc-meta">Texto legado</span>
          </div>
          ${
            canDel
              ? `<button type="button" class="btn-med-secondary entrega-proc-delete" data-action="delete">Eliminar</button>`
              : ''
          }
        </li>`;
      }

      if (item.type !== 'procedimiento') return '';

      const time = formatHHmm(item.scheduledAt);
      const canDel = canDeletePendienteItem(item, entregaDraft.actor);
      const kindLabel = item.kind === 'imagen' ? 'Imagen' : 'Otro';

      const flagRow = `
        <div class="entrega-proc-flags">
          <label><input type="checkbox" data-flag="comentado" ${item.comentado ? 'checked' : ''}> Comentado</label>
          <label><input type="checkbox" data-flag="autorizado" ${item.autorizado ? 'checked' : ''}> Autorizado</label>
          <label><input type="checkbox" data-flag="agendado" ${item.agendado ? 'checked' : ''}> Agendado</label>
        </div>`;

      return `<li class="entrega-proc-card" data-item-id="${escapeHtml(item.id)}">
        <div class="entrega-proc-card-main">
          <div class="entrega-proc-title-row">
            <span class="entrega-proc-label">${escapeHtml(item.label)}</span>
            ${time ? `<span class="entrega-proc-time">${escapeHtml(time)}</span>` : ''}
            <span class="entrega-proc-kind">${escapeHtml(kindLabel)}</span>
          </div>
          <div class="entrega-proc-chips">${renderStatusChips(item)}${renderBadgeChips(item)}</div>
          ${flagRow}
        </div>
        ${
          canDel
              ? `<button type="button" class="btn-med-secondary entrega-proc-delete" data-action="delete">Eliminar</button>`
            : ''
        }
      </li>`;
    })
    .join('');
}

function updateItemFlags(itemId, flag, checked) {
  entregaDraft.items = entregaDraft.items.map((it) => {
    if (it.id !== itemId || it.type !== 'procedimiento') return it;
    return {
      ...it,
      [flag]: !!checked,
      updatedAt: new Date().toISOString(),
    };
  });
  renderProcList();
}

function deleteItem(itemId) {
  const item = entregaDraft.items.find((it) => it.id === itemId);
  if (!item || !entregaDraft.actor || !canDeletePendienteItem(item, entregaDraft.actor)) {
    toast('No puedes eliminar este procedimiento.', 'error');
    return;
  }
  entregaDraft.items = entregaDraft.items.filter((it) => it.id !== itemId);
  renderProcList();
}

function readFormFields(formEl) {
  const kindRaw = formEl.querySelector('[name="entrega-proc-kind"]')?.value;
  const kind = kindRaw === 'otro' ? 'otro' : 'imagen';
  const label = String(formEl.querySelector('[name="entrega-proc-label"]')?.value || '').trim();
  const time = readTimeFromForm(formEl);
  return {
    kind,
    label,
    scheduledAt: scheduledAtFromTimeInput(time),
    comentado: !!formEl.querySelector('[name="entrega-proc-comentado"]')?.checked,
    autorizado: !!formEl.querySelector('[name="entrega-proc-autorizado"]')?.checked,
    agendado: !!formEl.querySelector('[name="entrega-proc-agendado"]')?.checked,
    requires: {
      familiar: !!formEl.querySelector('[name="entrega-req-familiar"]')?.checked,
      consentimiento: !!formEl.querySelector('[name="entrega-req-consentimiento"]')?.checked,
      anestesia: !!formEl.querySelector('[name="entrega-req-anestesia"]')?.checked,
    },
  };
}

function buildAddFormMarkup(prefill = null) {
  const p = prefill || {};
  const timeVal = p.scheduledAt ? formatHHmm(p.scheduledAt) : '';
  const kindIsOtro = p.kind === 'otro';
  return `
    <div class="entrega-inline-form" role="group" aria-label="Agregar procedimiento">
      <div class="entrega-inline-form__head">
        <h4 class="entrega-inline-form__title">Nuevo procedimiento</h4>
        <button type="button" class="entrega-inline-form__close" data-action="cancel-form" aria-label="Cerrar">×</button>
      </div>
      <div class="entrega-inline-form__grid">
        <div class="field-group">
          <label for="entrega-proc-kind">Tipo</label>
          <select id="entrega-proc-kind" name="entrega-proc-kind" class="profile-input">
            <option value="imagen" ${kindIsOtro ? '' : 'selected'}>Imagen</option>
            <option value="otro" ${kindIsOtro ? 'selected' : ''}>Otro</option>
          </select>
        </div>
        <div class="field-group entrega-inline-form__label-wide">
          <label for="entrega-proc-label">Descripción</label>
          <input id="entrega-proc-label" name="entrega-proc-label" class="profile-input" type="text" required placeholder="Ej. TAC tórax, endoscopia…" value="${escapeHtml(p.label || '')}">
        </div>
        <div class="field-group entrega-inline-form__time">
          <span class="entrega-field-label-block">Hora</span>
          ${buildTimeSelectMarkup(timeVal, { allowBlank: false, picker: true })}
        </div>
      </div>
      <div class="entrega-check-section">
        <span class="entrega-check-section__label">Estado</span>
        <div class="entrega-check-pills">
          ${checkPill('entrega-proc-comentado', 'Comentado', p.comentado)}
          ${checkPill('entrega-proc-autorizado', 'Autorizado', p.autorizado)}
          ${checkPill('entrega-proc-agendado', 'Agendado', p.agendado)}
        </div>
      </div>
      <div class="entrega-check-section">
        <span class="entrega-check-section__label">Requiere</span>
        <div class="entrega-check-pills">
          ${checkPill('entrega-req-familiar', 'Familiar', p.requires?.familiar)}
          ${checkPill('entrega-req-consentimiento', 'Consentimiento', p.requires?.consentimiento)}
          ${checkPill('entrega-req-anestesia', 'Anestesia', p.requires?.anestesia)}
        </div>
      </div>
      <div class="entrega-inline-form__foot">
        <div class="entrega-inline-form__foot-actions entrega-inline-form__foot-actions--end">
          <button type="button" class="btn-cancel" data-action="cancel-form">Cancelar</button>
          <button type="button" class="btn-save" data-action="add-item">Añadir</button>
        </div>
      </div>
    </div>`;
}

function showAddForm(prefill = null) {
  ensureProcDetailsOpen();
  const wrap = document.getElementById('entrega-proc-form');
  if (!wrap) return;
  wrap.innerHTML = buildAddFormMarkup(prefill);
  wrap.classList.remove('hidden');
  wrap.setAttribute('aria-hidden', 'false');
  wrap.querySelector('[name="entrega-proc-label"]')?.focus();
}

function hideAddForm() {
  const wrap = document.getElementById('entrega-proc-form');
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.classList.add('hidden');
  wrap.setAttribute('aria-hidden', 'true');
}

function addItemFromForm(formEl) {
  if (!entregaDraft.actor) {
    toast('No se pudo agregar el procedimiento. Cierra y vuelve a abrir la entrega.', 'error');
    return;
  }
  const fields = readFormFields(formEl);
  if (!fields.label) {
    toast('Indica la etiqueta del procedimiento.', 'error');
    return;
  }
  const item = createProcedimientoItem({
    ...fields,
    lockedBase: entregaDraft.actor.role === 'diurno',
    createdBy: entregaDraft.actor.userId
      ? { userId: entregaDraft.actor.userId, rank: entregaDraft.actor.rank || '' }
      : null,
  });
  entregaDraft.items.push(item);
  hideAddForm();
  renderProcList();
}

function entregaProcEventRoot() {
  return document.getElementById('entrega-modal') || document.getElementById('entrega-form');
}

function wireProcUiOnce() {
  if (entregaUiFlags.procWired) return;
  const root = entregaProcEventRoot();
  if (!root) return;
  entregaUiFlags.procWired = true;

  root.addEventListener('click', (ev) => {
    if (ev.target.closest('#btn-entrega-add-proc')) {
      ev.preventDefault();
      showAddForm();
    }
  });

  root.addEventListener('click', (ev) => {
    const delBtn = ev.target.closest('#entrega-proc-list [data-action="delete"]');
    if (!delBtn) return;
    const card = delBtn.closest('[data-item-id]');
    const id = card?.getAttribute('data-item-id');
    if (id) deleteItem(id);
  });

  root.addEventListener('change', (ev) => {
    const input = ev.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.flag) return;
    if (!input.closest('#entrega-proc-list')) return;
    const card = input.closest('[data-item-id]');
    const id = card?.getAttribute('data-item-id');
    if (id) updateItemFlags(id, input.dataset.flag, input.checked);
  });

  root.addEventListener('click', (ev) => {
    const btn = ev.target.closest('#entrega-proc-form [data-action]');
    if (!btn) return;
    const formWrap = document.getElementById('entrega-proc-form');
    if (!formWrap) return;
    const action = btn.getAttribute('data-action');
    const inner = formWrap.querySelector('.entrega-inline-form');
    if (action === 'cancel-form') {
      hideAddForm();
      return;
    }
    if (!inner) return;
    if (action === 'add-item') addItemFromForm(inner);
  });

  const teamSelect = document.getElementById('entrega-source-team');
  if (teamSelect && !teamSelect._rpcEntregaTeamWired) {
    teamSelect._rpcEntregaTeamWired = true;
    teamSelect.addEventListener('change', (ev) => {
      entregaDraft.sourceTeamId = String(ev.target?.value || '');
    });
  }
}

export { hideAddForm, renderProcList, wireProcUiOnce };
