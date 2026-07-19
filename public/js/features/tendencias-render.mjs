import { scheduleAfterPaint } from '../deferred-work.mjs';
import { buildTextSkeletonPanel } from '../ui-skeleton.mjs';
import { syncAbgLabPrefRowVisibility } from './tendencias-lab-prefs.mjs';
import * as tc from './tendencias-core.mjs';
import { renderTendenciasBody } from './tendencias-render-body.mjs';

function renderTendencias(opts) {
  opts = opts || {};
  var onReady = typeof opts.onReady === 'function' ? opts.onReady : null;
  syncAbgLabPrefRowVisibility();
  var container = document.getElementById('tendencias-container');
  if (!container) {
    if (onReady) onReady();
    return;
  }
  tc.ensureTendenciasClickDelegation();

  var paint = function () {
    try {
      renderTendenciasBody(container);
    } catch (err) {
      console.error('[R+ Tendencias] Error al renderizar:', err);
      container.innerHTML =
        '<p class="tend-empty">No se pudieron cargar las tendencias. Revisa la consola (F12) o recarga la app.</p>';
    }
    if (onReady) onReady();
  };

  if (opts.syncHeavy) {
    paint();
    return;
  }

  if (!container.querySelector('.tend-grid, .tend-toolbar, .tend-empty')) {
    container.innerHTML = buildTextSkeletonPanel('tend-skeleton skel-panel', 4);
  }
  scheduleAfterPaint(paint);
}

export { renderTendencias };
