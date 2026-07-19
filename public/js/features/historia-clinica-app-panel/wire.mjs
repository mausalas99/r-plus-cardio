import {
  ERC_CONDITION_ID,
  normalizeErcDetail,
  syncErcMedicationsToApp,
  purgeErcMedicationsFromApp,
} from '../../../../lib/historia-clinica/erc-detail.mjs';
import { newRowId } from './runtime.mjs';
import { readFlexibleDate } from './flex-date.mjs';

/**
 * @param {object} ctx
 * @param {ReturnType<import('./render-lists.mjs').createListRenderers>} renderers
 */
export function wireErcCard(ctx, renderers) {
  const { container, app, emit, getErcDetail } = ctx;
  const card = container.querySelector('[data-cond-id="' + ERC_CONDITION_ID + '"]');
  if (!card) return;
  const erc = getErcDetail();
  card.querySelectorAll('[data-erc-field]').forEach(function (el) {
    el.addEventListener('input', function () {
      erc[el.getAttribute('data-erc-field')] = el.value;
      emit();
    });
    el.addEventListener('change', function () {
      erc[el.getAttribute('data-erc-field')] = el.value;
      emit();
    });
  });
  const flex = card.querySelector('.hc-flex-date');
  if (flex) {
    flex.querySelectorAll('input,select').forEach(function (el) {
      el.addEventListener('change', function () {
        erc.diagnosedAt = readFlexibleDate(flex);
        emit();
      });
    });
  }
  const addMed = card.querySelector('#hc-erc-add-med');
  if (addMed) {
    addMed.onclick = function () {
      erc.medications.push({
        id: newRowId('erc'),
        medication: '',
        route: '',
        dosage: '',
        frequency: '',
      });
      syncErcMedicationsToApp(app);
      renderers.renderErcMeds();
      renderers.renderMedicamentos();
      emit();
    };
  }
  renderers.renderErcMeds();
}

/**
 * @param {object} ctx
 * @param {ReturnType<import('./render-lists.mjs').createListRenderers>} renderers
 */
export function wireConditionCards(ctx) {
  const { container, app, emit, remount } = ctx;

  container.querySelectorAll('.hc-check-chip-input').forEach(function (el) {
    el.addEventListener('change', function () {
      const id = el.getAttribute('data-app-cond');
      const set = new Set(app.conditions || []);
      if (el.checked) {
        set.add(id);
        if (id === ERC_CONDITION_ID) {
          app.conditionDetails = app.conditionDetails || {};
          app.conditionDetails[ERC_CONDITION_ID] = normalizeErcDetail(
            app.conditionDetails[ERC_CONDITION_ID]
          );
        }
      } else {
        set.delete(id);
        if (id === ERC_CONDITION_ID) purgeErcMedicationsFromApp(app);
        else if (app.conditionDetails && app.conditionDetails[id]) delete app.conditionDetails[id];
      }
      app.conditions = Array.from(set);
      remount();
      emit();
    });
  });

  const addCustom = container.querySelector('#hc-app-add-custom');
  if (addCustom) {
    addCustom.onclick = function () {
      const input = container.querySelector('#hc-app-custom-label');
      const label = input && input.value ? input.value.trim() : '';
      if (!label) return;
      const id = newRowId('custom');
      app.customConditions.push({ id, label });
      app.conditions.push(id);
      app.conditionDetails[id] = { treatment: '' };
      if (input) input.value = '';
      remount();
      emit();
    };
  }

  container.querySelectorAll('.hc-app-cond-card:not(.hc-app-cond-card--erc)').forEach(function (card) {
    const id = card.getAttribute('data-cond-id');
    card.querySelectorAll('[data-cond-field]').forEach(function (el) {
      el.addEventListener('input', function () {
        app.conditionDetails[id] = app.conditionDetails[id] || {};
        app.conditionDetails[id][el.getAttribute('data-cond-field')] = el.value;
        emit();
      });
    });
    const flex = card.querySelector('.hc-flex-date');
    if (flex) {
      flex.querySelectorAll('input,select').forEach(function (el) {
        el.addEventListener('change', function () {
          app.conditionDetails[id] = app.conditionDetails[id] || {};
          app.conditionDetails[id].diagnosedAt = readFlexibleDate(flex);
          emit();
        });
      });
    }
  });
}

export { wirePanelActions } from './wire-actions.mjs';
