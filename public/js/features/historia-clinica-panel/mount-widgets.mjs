import { applyClinicalHistoryUppercase } from '../../../../lib/historia-clinica/clinical-text.mjs';
import { HC_INTERROGADO_NEGADO } from '../../../../lib/historia-clinica/defaults.mjs';
import { summarizeToxicomanias } from '../../../../lib/historia-clinica/toxicomanias.mjs';
import { renderChecklistBlock } from '../historia-clinica-checklist.mjs';
import { mountTabaquismoWidget, mountAlcoholismoWidget } from '../historia-clinica-apnp-widgets.mjs';
import { mountToxicomaniasPanel } from '../historia-clinica-toxicomanias.mjs';
import { mountHistoriaAppPanel } from '../historia-clinica-app-panel.mjs';
import { mountHistoriaAhfPanel } from '../historia-clinica-ahf-panel.mjs';
import { mountHistoriaGeneroPanel } from '../historia-clinica-genero-panel.mjs';
import { wireClinicalHistoryUppercase } from '../historia-clinica-uppercase.mjs';
import { esc } from './runtime.mjs';
import { appConditions, ahfConditions, ipasSystems } from './catalogs.mjs';
import { compileCtx } from './data-normalize.mjs';
import { getDirtyKeys, hcState } from './state.mjs';

export function mountApnpHabits(root, patient) {
  if (!hcState.data.apnp) hcState.data.apnp = {};
  var tabEl = root.querySelector('#hc-mount-tabaquismo');
  if (tabEl) {
    mountTabaquismoWidget(
      tabEl,
      hcState.data.apnp.tabaquismoDetail,
      compileCtx(patient),
      function (detail, summary) {
        hcState.data.apnp.tabaquismoDetail = detail;
        hcState.data.apnp.tabaquismo = summary;
        getDirtyKeys().add('apnp');
      }
    );
  }
  var alcEl = root.querySelector('#hc-mount-alcoholismo');
  if (alcEl) {
    mountAlcoholismoWidget(alcEl, hcState.data.apnp.alcoholismoDetail, function (detail, summary) {
      hcState.data.apnp.alcoholismoDetail = detail;
      hcState.data.apnp.alcoholismo = summary;
      getDirtyKeys().add('apnp');
    });
  }
  var toxEl = root.querySelector('#hc-mount-toxicomanias');
  if (toxEl) {
    mountToxicomaniasPanel(toxEl, hcState.data.apnp || {}, function (nextApnp) {
      applyClinicalHistoryUppercase(nextApnp);
      const tox = summarizeToxicomanias(nextApnp);
      hcState.data.apnp = Object.assign({}, hcState.data.apnp, nextApnp, {
        toxicomaniasEntries: tox.entries,
        toxicomanias: tox.summary,
      });
      getDirtyKeys().add('apnp');
      wireClinicalHistoryUppercase(toxEl);
    });
  }
}

export function mountChecklists(root, patient) {
  var appEl = root.querySelector('#hc-mount-app');
  if (appEl) {
    mountHistoriaAppPanel(appEl, hcState.data.app || {}, appConditions, function (next) {
      applyClinicalHistoryUppercase(next);
      hcState.data.app = next;
      getDirtyKeys().add('app');
      wireClinicalHistoryUppercase(appEl);
    });
  }
  var ahfEl = root.querySelector('#hc-mount-ahf');
  if (ahfEl) {
    mountHistoriaAhfPanel(ahfEl, hcState.data.ahf || {}, ahfConditions, function (next) {
      applyClinicalHistoryUppercase(next);
      hcState.data.ahf = next;
      getDirtyKeys().add('ahf');
      wireClinicalHistoryUppercase(ahfEl);
    });
  }
  var genEl = root.querySelector('#hc-mount-genero');
  if (genEl) {
    mountHistoriaGeneroPanel(
      genEl,
      hcState.data.genero || {},
      patient && patient.sexo,
      function (next) {
        applyClinicalHistoryUppercase(next);
        hcState.data.genero = next;
        getDirtyKeys().add('genero');
        wireClinicalHistoryUppercase(genEl);
      }
    );
  }
  var ipasHost = root.querySelector('#hc-mount-ipas');
  if (ipasHost) {
    ipasHost.innerHTML = '';
    Object.keys(ipasSystems).forEach(function (sid) {
      var wrap = document.createElement('details');
      wrap.className = 'card';
      wrap.open = true;
      wrap.innerHTML =
        '<summary class="card-header">' + esc(ipasSystems[sid]) + '</summary><div class="card-body"></div>';
      ipasHost.appendChild(wrap);
      var body = wrap.querySelector('.card-body');
      renderChecklistBlock(
        body,
        { id: sid, variant: 'negado_default', options: [] },
        (hcState.data.ipas && hcState.data.ipas[sid]) || {
          checks: [],
          descripcion: HC_INTERROGADO_NEGADO,
          negado: true,
        },
        function (next) {
          if (!hcState.data.ipas) hcState.data.ipas = {};
          hcState.data.ipas[sid] = next;
          getDirtyKeys().add('ipas');
        }
      );
    });
  }
}
