import { getChartJsIfLoaded, loadChartJs } from '../vendor-loader.mjs';
import { destroyEaChartInstance } from './estado-actual-charts-chartjs.mjs';
import { stripMonitoreoChartRuntimeCache } from './estado-actual-charts-display.mjs';
import { destroyEstadoActualCharts, renderEstadoActualCharts } from './estado-actual-charts.mjs';

/** @type {{ getPatient(): { monitoreo?: unknown } | null, getActiveId(): string | null, showToast(msg: string, type?: string): void }} */
let rt = {
  getPatient() {
    return null;
  },
  getActiveId() {
    return null;
  },
  showToast() {},
};

var dismissWired = false;

export function registerEstadoActualChartsModalRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

function getBackdrop() {
  return document.getElementById('ea-charts-backdrop');
}

function getMount() {
  return document.getElementById('ea-charts-modal-mount');
}

export function closeEstadoActualChartsModal() {
  var backdrop = getBackdrop();
  if (!backdrop) return;
  destroyEaChartInstance();
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
}

function paintEaChartsModal(mount, monitoreo, ChartCtor) {
  if (!mount) return;
  renderEstadoActualCharts(mount, monitoreo, ChartCtor, { showTitle: false });
}

export function openEstadoActualChartsModal() {
  var backdrop = getBackdrop();
  if (!backdrop) {
    rt.showToast('Gráficas de monitoreo no disponibles', 'error');
    return;
  }
  var patient = rt.getPatient();
  if (!patient || !patient.monitoreo) {
    rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  var mount = getMount();
  var activeId = rt.getActiveId ? rt.getActiveId() : null;
  stripMonitoreoChartRuntimeCache(patient.monitoreo);
  if (mount) {
    destroyEstadoActualCharts(mount);
    mount._eaChartsSig = '';
    mount._eaChartsLayoutKey = '';
    mount._eaChartsPatientId = activeId;
  }

  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');

  function paint(ChartCtor) {
    if (!ChartCtor) {
      if (mount) {
        var empty = document.getElementById('ea-charts-empty');
        if (empty) {
          empty.className = 'ea-charts-empty empty-state empty-state--compact';
          empty.setAttribute('role', 'status');
          empty.innerHTML =
            '<span class="empty-state-title">Gráficas no disponibles</span>' +
            '<span class="empty-state-lead">Chart.js no está disponible. Recarga la aplicación.</span>';
          empty.hidden = false;
        }
      }
      return;
    }
    paintEaChartsModal(mount, patient.monitoreo, ChartCtor);
  }

  var Chart = getChartJsIfLoaded();
  if (Chart) {
    paint(Chart);
    return;
  }
  void loadChartJs()
    .then(paint)
    .catch(function () {
      paint(undefined);
    });
}

function handleEaChartsEscape(ev) {
  if (ev.key !== 'Escape' && ev.key !== 'Esc') return;
  var backdrop = getBackdrop();
  if (!backdrop || !backdrop.classList.contains('open')) return;
  closeEstadoActualChartsModal();
  ev.preventDefault();
  ev.stopPropagation();
}

/** Escape y clic fuera del panel de gráficas. */
export function wireEaChartsModalDismiss() {
  if (dismissWired) return;
  dismissWired = true;
  document.addEventListener('keydown', handleEaChartsEscape, true);
  var backdrop = getBackdrop();
  if (backdrop) {
    backdrop.addEventListener('click', function (ev) {
      if (!backdrop.classList.contains('open')) return;
      if (ev.target !== backdrop) return;
      closeEstadoActualChartsModal();
    });
  }
}

export const windowHandlers = {
  openEstadoActualChartsModal,
  closeEstadoActualChartsModal,
};
