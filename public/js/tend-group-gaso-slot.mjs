import { getSetTrendValueForSeries } from './tend-core.mjs';
import { evaluateGasoExtended } from './gaso-extended.mjs';

export function serieNumFromLabSet(set, sec, fk) {
  var v = getSetTrendValueForSeries(set, sec, fk);
  return v != null && isFinite(v) ? v : null;
}

export function fmtGasoNum(n, unit) {
  if (n == null || !isFinite(n)) return '—';
  return String(n) + (unit ? ' ' + unit : '');
}

export function primaryDisorderLabel(disorder, type) {
  var dMap = {
    metabolic: 'Metabólico',
    respiratory: 'Respiratorio',
    mixed: 'Mixto',
    compensated: 'Compensado',
    unknown: 'Indeterminado',
  };
  var tMap = { acidosis: 'acidosis', alkalosis: 'alcalosis', none: '' };
  var d = dMap[String(disorder || '').toLowerCase()] || String(disorder || '—');
  var t = tMap[String(type || '').toLowerCase()] || '';
  return t ? d + ' · ' + t : d;
}

export function gasoMetricChip(label, value, tone) {
  var chip = document.createElement('span');
  chip.className = 'tend-gaso-chip' + (tone ? ' tend-gaso-chip--' + tone : '');
  var lbl = document.createElement('span');
  lbl.className = 'tend-gaso-chip-label';
  lbl.textContent = label;
  var val = document.createElement('strong');
  val.className = 'tend-gaso-chip-val';
  val.textContent = value;
  chip.appendChild(lbl);
  chip.appendChild(val);
  return chip;
}

export function gasoSubMetric(label, value) {
  var sub = document.createElement('div');
  sub.className = 'tend-gaso-sub';
  var lbl = document.createElement('span');
  lbl.className = 'tend-gaso-sub-label';
  lbl.textContent = label;
  var val = document.createElement('span');
  val.className = 'tend-gaso-sub-val';
  val.textContent = value;
  sub.appendChild(lbl);
  sub.appendChild(val);
  return sub;
}

export function gasoStepCard(num, title, bodyEl) {
  var art = document.createElement('article');
  art.className = 'tend-gaso-step';
  var numEl = document.createElement('span');
  numEl.className = 'tend-gaso-step-num';
  numEl.textContent = String(num);
  var body = document.createElement('div');
  body.className = 'tend-gaso-step-body';
  var h = document.createElement('h5');
  h.className = 'tend-gaso-step-title';
  h.textContent = title;
  body.appendChild(h);
  body.appendChild(bodyEl);
  art.appendChild(numEl);
  art.appendChild(body);
  return art;
}

export function gasoStepText(txt) {
  var p = document.createElement('p');
  p.className = 'tend-gaso-step-text';
  p.textContent = String(txt || '');
  return p;
}

function phChipTone(pH) {
  if (pH == null) return '';
  if (pH < 7.35) return 'low';
  if (pH > 7.45) return 'high';
  return '';
}

function agChipTone(value) {
  return value != null && value > 12 ? 'high' : '';
}

function extractGasoLabValues(latest) {
  return {
    na:
      serieNumFromLabSet(latest, 'QS', 'Na') ??
      serieNumFromLabSet(latest, 'ESC', 'Na') ??
      serieNumFromLabSet(latest, 'GASES', 'Na'),
    cl:
      serieNumFromLabSet(latest, 'QS', 'Cl') ??
      serieNumFromLabSet(latest, 'ESC', 'Cl'),
    alb: serieNumFromLabSet(latest, 'PFHs', 'Alb'),
    pH: serieNumFromLabSet(latest, 'GASES', 'pH'),
    pCO2: serieNumFromLabSet(latest, 'GASES', 'pCO2'),
    pO2: serieNumFromLabSet(latest, 'GASES', 'pO2'),
    bic: serieNumFromLabSet(latest, 'GASES', 'Bica'),
    uag: serieNumFromLabSet(latest, 'GASES', 'UAG'),
  };
}

function appendPrimaryStep(steps, ev) {
  var primaryBody = document.createElement('div');
  var primaryBadge = document.createElement('span');
  primaryBadge.className = 'tend-gaso-badge tend-gaso-badge--tip';
  primaryBadge.tabIndex = 0;
  primaryBadge.textContent = primaryDisorderLabel(ev.steps.primary.disorder, ev.steps.primary.type);
  var primaryRationale = String(ev.steps.primary.rationale || '').trim();
  if (primaryRationale) {
    var primaryTipId = 'tend-gaso-primary-rationale';
    primaryBadge.setAttribute('aria-describedby', primaryTipId);
    var primaryTip = document.createElement('span');
    primaryTip.id = primaryTipId;
    primaryTip.className = 'tend-gaso-tip';
    primaryTip.setAttribute('role', 'tooltip');
    primaryTip.textContent = primaryRationale;
    primaryBadge.appendChild(primaryTip);
  }
  primaryBody.appendChild(primaryBadge);
  steps.appendChild(gasoStepCard(2, 'Trastorno predominante', primaryBody));
}

function appendCompensationStep(steps, cmp) {
  var cmpBody = document.createElement('div');
  var cmpGrid = document.createElement('div');
  cmpGrid.className = 'tend-gaso-subgrid';
  if (cmp.expectedPCO2 != null) {
    cmpGrid.appendChild(gasoSubMetric('PaCO₂ Winter', '~' + cmp.expectedPCO2 + ' mmHg'));
  }
  if (cmp.expectedHCO3Acute != null) {
    cmpGrid.appendChild(gasoSubMetric('HCO₃⁻ agudo', '~' + cmp.expectedHCO3Acute));
  }
  if (cmp.expectedHCO3Chronic != null) {
    cmpGrid.appendChild(gasoSubMetric('HCO₃⁻ crónico', '~' + cmp.expectedHCO3Chronic));
  }
  if (cmpGrid.childNodes.length) cmpBody.appendChild(cmpGrid);
  cmpBody.appendChild(gasoStepText(cmp.note));
  steps.appendChild(gasoStepCard(3, 'Compensación esperada', cmpBody));
}

function appendBadgeStep(steps, num, title, badgeText, badgeWarn, interpretation) {
  var body = document.createElement('div');
  if (badgeText != null) {
    var badge = document.createElement('span');
    badge.className = 'tend-gaso-badge' + (badgeWarn ? ' tend-gaso-badge--warn' : '');
    badge.textContent = badgeText;
    body.appendChild(badge);
  }
  body.appendChild(gasoStepText(interpretation));
  steps.appendChild(gasoStepCard(num, title, body));
}

function appendOxygenationStep(steps, ox) {
  var oxBody = document.createElement('div');
  var oxGrid = document.createElement('div');
  oxGrid.className = 'tend-gaso-subgrid';
  if (ox.pfRatio != null) {
    oxGrid.appendChild(gasoSubMetric('P/F', '≈ ' + ox.pfRatio));
  }
  if (ox.aaGradient != null) {
    oxGrid.appendChild(gasoSubMetric('Gradiente A–a', '≈ ' + ox.aaGradient + ' mmHg'));
  }
  if (oxGrid.childNodes.length) oxBody.appendChild(oxGrid);
  oxBody.appendChild(gasoStepText(ox.note));
  steps.appendChild(gasoStepCard(7, 'Oxigenación', oxBody));
}

function buildGasoMetricsRow(lab, ev) {
  var metrics = document.createElement('div');
  metrics.className = 'tend-gaso-metrics';
  metrics.appendChild(gasoMetricChip('pH', fmtGasoNum(lab.pH), phChipTone(lab.pH)));
  metrics.appendChild(gasoMetricChip('PaCO₂', fmtGasoNum(lab.pCO2, 'mmHg')));
  metrics.appendChild(gasoMetricChip('HCO₃⁻', fmtGasoNum(lab.bic, 'mEq/L')));
  var agDisplay =
    ev.steps.anionGap.corrected != null ? ev.steps.anionGap.corrected : ev.steps.anionGap.value;
  metrics.appendChild(
    gasoMetricChip(
      ev.steps.anionGap.corrected != null ? 'AGc' : 'Anión gap',
      fmtGasoNum(agDisplay, 'mEq/L'),
      agChipTone(agDisplay)
    )
  );
  if (ev.steps.urinaryAnionGap && ev.steps.urinaryAnionGap.value != null) {
    metrics.appendChild(
      gasoMetricChip('UAG', fmtGasoNum(ev.steps.urinaryAnionGap.value, 'mEq/L'))
    );
  }
  return metrics;
}

function buildGasoSteps(ev) {
  var steps = document.createElement('div');
  steps.className = 'tend-gaso-steps';
  steps.appendChild(gasoStepCard(1, 'Estado ácido-base', gasoStepText(ev.steps.ph.interpretation)));
  appendPrimaryStep(steps, ev);
  appendCompensationStep(steps, ev.steps.compensation);
  var ag = ev.steps.anionGap;
  var agBadge =
    ag.corrected != null
      ? 'AGc ' + ag.corrected + ' (AG ' + ag.value + ') mEq/L'
      : ag.value != null
        ? ag.value + ' mEq/L'
        : null;
  var agHigh =
    (ag.corrected != null ? ag.corrected : ag.value) != null &&
    (ag.corrected != null ? ag.corrected : ag.value) > 12;
  appendBadgeStep(steps, 4, 'Anión gap', agBadge, agHigh, ag.interpretation);
  var uag = ev.steps.urinaryAnionGap;
  appendBadgeStep(
    steps,
    5,
    'UAG (urinario)',
    uag && uag.value != null ? uag.value + ' mEq/L' : null,
    false,
    uag ? uag.interpretation : ''
  );
  var dd = ev.steps.deltaDelta;
  appendBadgeStep(steps, 6, 'Delta-delta', dd.value != null ? String(dd.value) : null, false, dd.interpretation);
  appendOxygenationStep(steps, ev.steps.oxygenation);
  return steps;
}

function appendGasoSummary(slot, summaryLines) {
  if (!summaryLines || !summaryLines.length) return;
  var hs = document.createElement('details');
  hs.className = 'tend-gaso-summary';
  var sm = document.createElement('summary');
  sm.textContent = 'Resumen rápido';
  hs.appendChild(sm);
  var ul = document.createElement('ul');
  ul.className = 'tend-gaso-summary-list';
  summaryLines.forEach(function (ln) {
    var li = document.createElement('li');
    li.textContent = ln;
    ul.appendChild(li);
  });
  hs.appendChild(ul);
  slot.appendChild(hs);
}

function renderGasoEmptySlot(slot, escHtml, message, isError) {
  var color = isError ? 'var(--error)' : 'var(--text-muted)';
  slot.innerHTML =
    '<p class="tend-empty" style="font-size:13px;color:' +
    color +
    ';">' +
    escHtml(message) +
    '</p>';
}

/** @param {HTMLElement} slot */
export function refillGasoExtendedSlot(slot, latest, fio2, escHtml) {
  if (!slot) return;
  slot.innerHTML = '';

  if (!latest || !latest.parsedBySection) {
    renderGasoEmptySlot(slot, escHtml, 'Sin valores recientes disponibles para gasometría.', false);
    return;
  }

  var lab = extractGasoLabValues(latest);
  try {
    var ev = evaluateGasoExtended({
      pH: lab.pH,
      pCO2: lab.pCO2,
      pO2: lab.pO2,
      hco3: lab.bic,
      na: lab.na,
      cl: lab.cl,
      alb: lab.alb,
      uag: lab.uag,
      fio2: fio2,
    });

    var panel = document.createElement('div');
    panel.className = 'tend-gaso-ext-panel';
    panel.appendChild(buildGasoMetricsRow(lab, ev));
    panel.appendChild(buildGasoSteps(ev));
    slot.appendChild(panel);
    appendGasoSummary(slot, ev.summaryLines);
  } catch (e) {
    renderGasoEmptySlot(slot, escHtml, 'No se pudo calcular la gasometría extendida.', true);
    console.error('evaluateGasoExtended', e);
  }
}
