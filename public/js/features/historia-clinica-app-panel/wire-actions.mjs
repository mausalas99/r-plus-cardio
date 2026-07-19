import { defaultFlexibleDate } from '../../../../lib/historia-clinica/flexible-date.mjs';
import { newRowId } from './runtime.mjs';
import { wireFlexibleDate } from './flex-date.mjs';

export function wireAlergiaToggle(ctx, renderers) {
  const { container, app, emit } = ctx;
  const negadoEl = container.querySelector('#hc-app-alergias-negado');
  const alBody = container.querySelector('#hc-app-alergias-body');
  const alActions = container.querySelector('#hc-app-alergias-actions');
  if (!negadoEl) return { negadoEl, alBody, alActions };

  negadoEl.addEventListener('change', function () {
    app.alergiasNegado = negadoEl.checked;
    if (app.alergiasNegado) app.alergiaMedicamentos = [];
    alBody.classList.toggle('hc-app-special-body--hidden', app.alergiasNegado);
    alActions.classList.toggle('hc-app-special-body--hidden', app.alergiasNegado);
    if (!app.alergiasNegado) renderers.renderAlergias();
    emit();
  });
  return { negadoEl, alBody, alActions };
}

export function wireAppFields(ctx) {
  const { container, app, emit } = ctx;
  container.querySelectorAll('[data-app-field]').forEach(function (el) {
    el.addEventListener('input', function () {
      app[el.getAttribute('data-app-field')] = el.value;
      emit();
    });
  });
}

export function wireAddButtons(ctx, renderers, alergiaUi) {
  const { container, app, emit } = ctx;
  const { negadoEl, alBody, alActions } = alergiaUi;

  const addAlergia = container.querySelector('#hc-app-add-alergia');
  if (addAlergia) {
    addAlergia.onclick = function () {
      app.alergiasNegado = false;
      if (negadoEl) negadoEl.checked = false;
      app.alergiaMedicamentos.push({ id: newRowId('al'), medication: '' });
      alBody.classList.remove('hc-app-special-body--hidden');
      alActions.classList.remove('hc-app-special-body--hidden');
      renderers.renderAlergias();
      emit();
    };
  }

  const addTrauma = container.querySelector('#hc-app-add-trauma');
  if (addTrauma) {
    addTrauma.onclick = function () {
      app.traumaticosEntries.push({
        id: newRowId('tr'),
        description: '',
        date: defaultFlexibleDate(),
      });
      renderers.renderTrauma();
      emit();
    };
  }

  const addTf = container.querySelector('#hc-app-add-transfusion');
  if (addTf) {
    addTf.onclick = function () {
      app.transfusionesEntries.push({
        id: newRowId('tf'),
        units: '',
        adverseReactions: '',
        date: defaultFlexibleDate(),
      });
      renderers.renderTransfusiones();
      emit();
    };
  }

  const addMed = container.querySelector('#hc-app-add-medicamento');
  if (addMed) {
    addMed.onclick = function () {
      app.medicamentosActuales.push({
        id: newRowId('med'),
        medication: '',
        route: '',
        dosage: '',
        frequency: '',
      });
      renderers.renderMedicamentos();
      emit();
    };
  }

  const addCir = container.querySelector('#hc-app-add-cirugia');
  if (addCir) {
    addCir.onclick = function () {
      app.cirugias.push({ procedure: '', complications: '', date: defaultFlexibleDate() });
      renderers.renderCirugias();
      emit();
    };
  }

  const addHosp = container.querySelector('#hc-app-add-hosp');
  if (addHosp) {
    addHosp.onclick = function () {
      app.hospitalizaciones.push({
        reason: '',
        duration: '',
        complications: '',
        date: defaultFlexibleDate(),
      });
      renderers.renderHosps();
      emit();
    };
  }
}

export function wirePanelActions(ctx, renderers) {
  const { container } = ctx;
  container.querySelectorAll('.hc-flex-date').forEach(wireFlexibleDate);
  const alergiaUi = wireAlergiaToggle(ctx, renderers);
  wireAppFields(ctx);
  wireAddButtons(ctx, renderers, alergiaUi);
}
