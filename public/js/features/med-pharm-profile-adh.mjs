import { cellValueAtColumn } from '../med-pharm-view-window.mjs';
import {
  esc,
  monthLabel,
  mp,
  notAdminAtColumn,
  windowHasMultipleMonths,
  MONTH_ABBR,
} from './med-pharm-profile-state.mjs';

function formatAdhDayList(columns, multiMonth) {
  if (!columns.length) return '—';
  return columns
    .map(function (col) {
      var dd = String(col.day).padStart(2, '0');
      return multiMonth ? dd + ' ' + MONTH_ABBR[col.monthIndex] : dd;
    })
    .join(', ');
}

function adherenceDayDetail(row, columns, profile) {
  return adherenceDayDetailForRowKeys(profile, [row.rowKey], columns);
}

function adherenceDayDetailForRowKeys(profile, rowKeys, columns) {
  var indicated = [];
  var missed = [];
  for (var i = 0; i < columns.length; i += 1) {
    var col = columns[i];
    var dayIndicated = false;
    var dayMissed = false;
    for (var k = 0; k < rowKeys.length; k += 1) {
      if (!(cellValueAtColumn(profile, rowKeys[k], col) > 0)) continue;
      dayIndicated = true;
      if (notAdminAtColumn(profile, rowKeys[k], col)) dayMissed = true;
    }
    if (!dayIndicated) continue;
    indicated.push(col);
    if (dayMissed) missed.push(col);
  }
  var administered = indicated.filter(function (col) {
    return missed.indexOf(col) < 0;
  });
  return { indicated: indicated, missed: missed, administered: administered };
}

function adherenceStatsForWindow(profile, rowKey, columns) {
  var indicated = 0;
  var missed = 0;
  var missedDays = [];
  for (var i = 0; i < columns.length; i += 1) {
    var col = columns[i];
    if (!(cellValueAtColumn(profile, rowKey, col) > 0)) continue;
    indicated += 1;
    if (notAdminAtColumn(profile, rowKey, col)) {
      missed += 1;
      missedDays.push(col.day);
    }
  }
  return {
    indicated: indicated,
    effective: indicated - missed,
    missed: missed,
    missedDays: missedDays,
  };
}

function buildAdhPanelHtmlForGroup(group, columns, profile, windowLabel) {
  var detail = adherenceDayDetailForRowKeys(profile, group.rowKeys, columns);
  var multiMonth = windowHasMultipleMonths(columns);
  var monthTitle = windowLabel || monthLabel(mp.viewYear, mp.viewMonthIndex);
  var regimenNote =
    group.variants.length > 1
      ? '<p class="med-pharm-adh-panel-regimens">' +
        esc(String(group.variants.length)) +
        ' regímenes (dosis distintas) en esta ventana</p>'
      : '';
  return (
    regimenNote +
    '<p class="med-pharm-adh-panel-head">' +
    esc(monthTitle) +
    '</p>' +
    '<div class="med-pharm-adh-panel-section">' +
    '<span class="med-pharm-adh-panel-label med-pharm-adh-panel-label--ok">Administrados (por defecto)</span>' +
    '<p class="med-pharm-adh-panel-days">' +
    esc(formatAdhDayList(detail.administered, multiMonth)) +
    '</p>' +
    '</div>' +
    '<div class="med-pharm-adh-panel-section">' +
    '<span class="med-pharm-adh-panel-label med-pharm-adh-panel-label--miss">No administrados</span>' +
    '<p class="med-pharm-adh-panel-days">' +
    esc(formatAdhDayList(detail.missed, multiMonth)) +
    '</p>' +
    '</div>' +
    '<p class="med-pharm-adh-panel-foot">' +
    esc(String(detail.administered.length)) +
    ' administrados · ' +
    esc(String(detail.missed.length)) +
    ' no · ' +
    esc(String(detail.indicated.length)) +
    ' indicados</p>'
  );
}

function buildAdhPanelHtml(row, columns, profile, windowLabel) {
  var detail = adherenceDayDetail(row, columns, profile);
  var multiMonth = windowHasMultipleMonths(columns);
  var monthTitle = windowLabel || monthLabel(mp.viewYear, mp.viewMonthIndex);
  return (
    '<p class="med-pharm-adh-panel-head">' +
    esc(monthTitle) +
    '</p>' +
    '<div class="med-pharm-adh-panel-section">' +
    '<span class="med-pharm-adh-panel-label med-pharm-adh-panel-label--ok">Administrados (por defecto)</span>' +
    '<p class="med-pharm-adh-panel-days">' +
    esc(formatAdhDayList(detail.administered, multiMonth)) +
    '</p>' +
    '</div>' +
    '<div class="med-pharm-adh-panel-section">' +
    '<span class="med-pharm-adh-panel-label med-pharm-adh-panel-label--miss">No administrados</span>' +
    '<p class="med-pharm-adh-panel-days">' +
    esc(formatAdhDayList(detail.missed, multiMonth)) +
    '</p>' +
    '</div>' +
    '<p class="med-pharm-adh-panel-foot">' +
    esc(String(detail.administered.length)) +
    ' administrados · ' +
    esc(String(detail.missed.length)) +
    ' no · ' +
    esc(String(detail.indicated.length)) +
    ' indicados</p>'
  );
}

function buildAdhTriggerHtml(row, stats, columns, profile, windowLabel) {
  if (!stats.indicated) {
    return '<span class="med-pharm-adh-trigger med-pharm-adh-trigger--empty">—</span>';
  }
  var label =
    stats.missed > 0
      ? stats.effective + ' efect. · ' + stats.missed + ' no'
      : stats.effective + ' d efectivos';
  return (
    '<span class="med-pharm-adh-wrap">' +
    '<button type="button" class="med-pharm-adh-trigger' +
    (stats.missed > 0 ? ' med-pharm-adh-trigger--miss' : '') +
    '" data-row-key="' +
    esc(row.rowKey) +
    '" aria-haspopup="dialog">' +
    esc(label) +
    '</button>' +
    '<div class="med-pharm-adh-panel" role="dialog" aria-hidden="true">' +
    buildAdhPanelHtml(row, columns, profile, windowLabel) +
    '</div></span>'
  );
}

function buildAdhTriggerHtmlForGroup(group, stats, columns, profile, windowLabel) {
  if (!stats.indicated) {
    return '<span class="med-pharm-adh-trigger med-pharm-adh-trigger--empty">—</span>';
  }
  var label =
    stats.missed > 0
      ? stats.effective + ' efect. · ' + stats.missed + ' no'
      : stats.effective + ' d efectivos';
  return (
    '<span class="med-pharm-adh-wrap">' +
    '<button type="button" class="med-pharm-adh-trigger' +
    (stats.missed > 0 ? ' med-pharm-adh-trigger--miss' : '') +
    '" data-med-group-key="' +
    esc(group.medGroupKey) +
    '" aria-haspopup="dialog">' +
    esc(label) +
    '</button>' +
    '<div class="med-pharm-adh-panel" role="dialog" aria-hidden="true">' +
    buildAdhPanelHtmlForGroup(group, columns, profile, windowLabel) +
    '</div></span>'
  );
}

function buildMedCellInner(row, stats, columns, profile, windowLabel) {
  return (
    '<div class="med-cell-name">' +
    esc(row.med) +
    '</div>' +
    '<div class="med-cell-adh">' +
    buildAdhTriggerHtml(row, stats, columns, profile, windowLabel) +
    '</div>'
  );
}

var _medPharmAdhHoverWired = false;
var _medPharmAdhHideDelayMs = 140;

function medPharmAdhPanelForWrap(wrap) {
  return wrap.querySelector('.med-pharm-adh-panel') || wrap._medPharmAdhPanelEl || null;
}

function hideMedPharmAdhPanel(panel) {
  if (!panel) return;
  if (panel._medPharmAdhHideTid) {
    clearTimeout(panel._medPharmAdhHideTid);
    panel._medPharmAdhHideTid = null;
  }
  panel.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
  panel.style.left = '';
  panel.style.top = '';
  panel.style.visibility = '';
  var wrap = panel._medPharmAdhOwnerWrap;
  if (wrap) wrap._medPharmAdhPanelEl = null;
  panel._medPharmAdhOwnerWrap = null;
  if (wrap && wrap.isConnected) {
    wrap.appendChild(panel);
  } else if (panel.parentNode === document.body) {
    panel.remove();
  }
}

function scheduleHideMedPharmAdhPanel(panel) {
  if (!panel) return;
  if (panel._medPharmAdhHideTid) clearTimeout(panel._medPharmAdhHideTid);
  panel._medPharmAdhHideTid = setTimeout(function () {
    panel._medPharmAdhHideTid = null;
    hideMedPharmAdhPanel(panel);
  }, _medPharmAdhHideDelayMs);
}

function positionMedPharmAdhPanel(wrap) {
  var panel = medPharmAdhPanelForWrap(wrap);
  var trigger = wrap.querySelector('.med-pharm-adh-trigger');
  if (!panel || !trigger) return;
  document.querySelectorAll('.med-pharm-adh-panel.is-open').forEach(function (p) {
    var w = p._medPharmAdhOwnerWrap;
    if (w !== wrap) hideMedPharmAdhPanel(p);
  });
  if (panel._medPharmAdhHideTid) {
    clearTimeout(panel._medPharmAdhHideTid);
    panel._medPharmAdhHideTid = null;
  }
  panel._medPharmAdhOwnerWrap = wrap;
  wrap._medPharmAdhPanelEl = panel;
  if (panel.parentNode !== document.body) document.body.appendChild(panel);
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  panel.style.visibility = 'hidden';
  panel.style.left = '-9999px';
  panel.style.top = '0';
  void panel.offsetWidth;
  var anchor = trigger.getBoundingClientRect();
  var pr = panel.getBoundingClientRect();
  var margin = 8;
  var gap = 4;
  var top = anchor.bottom + gap;
  var left = anchor.left;
  if (top + pr.height > window.innerHeight - margin) {
    top = Math.max(margin, anchor.top - pr.height - gap);
  }
  if (left + pr.width > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - pr.width - margin);
  }
  if (left < margin) left = margin;
  panel.style.left = Math.round(left) + 'px';
  panel.style.top = Math.round(top) + 'px';
  panel.style.visibility = '';
}

function wireMedPharmAdhHoverPanels(rootEl) {
  if (!rootEl) return;
  rootEl.querySelectorAll('.med-pharm-adh-panel').forEach(function (panel) {
    if (panel._medPharmAdhPanelHoverListeners) return;
    panel._medPharmAdhPanelHoverListeners = true;
    panel.addEventListener('mouseenter', function () {
      if (panel._medPharmAdhHideTid) {
        clearTimeout(panel._medPharmAdhHideTid);
        panel._medPharmAdhHideTid = null;
      }
    });
    panel.addEventListener('mouseleave', function (ev) {
      var w = panel._medPharmAdhOwnerWrap || panel.closest('.med-pharm-adh-wrap');
      var toEl = ev.relatedTarget;
      if (toEl && w && (w.contains(toEl) || panel.contains(toEl))) return;
      scheduleHideMedPharmAdhPanel(panel);
    });
  });
}

function wireMedPharmAdhHoverOnce() {
  if (_medPharmAdhHoverWired) return;
  _medPharmAdhHoverWired = true;
  function wrapFromTarget(t) {
    if (!t || !t.closest) return null;
    return t.closest('.med-pharm-adh-wrap');
  }
  document.addEventListener('mouseover', function (ev) {
    var wrap = wrapFromTarget(ev.target);
    if (!wrap) return;
    positionMedPharmAdhPanel(wrap);
  });
  document.addEventListener('mouseout', function (ev) {
    var wrap = wrapFromTarget(ev.target);
    if (!wrap) return;
    var panel = medPharmAdhPanelForWrap(wrap);
    if (!panel) return;
    var toEl = ev.relatedTarget;
    if (toEl && (wrap.contains(toEl) || panel.contains(toEl))) return;
    scheduleHideMedPharmAdhPanel(panel);
  });
  document.addEventListener('focusin', function (ev) {
    var wrap = wrapFromTarget(ev.target);
    if (!wrap) return;
    positionMedPharmAdhPanel(wrap);
  });
  document.addEventListener('focusout', function (ev) {
    var wrap = wrapFromTarget(ev.target);
    if (!wrap) return;
    var panel = medPharmAdhPanelForWrap(wrap);
    if (!panel) return;
    var rel = ev.relatedTarget;
    if (rel && (wrap.contains(rel) || panel.contains(rel))) return;
    hideMedPharmAdhPanel(panel);
  });
  window.addEventListener(
    'scroll',
    function () {
      document.querySelectorAll('.med-pharm-adh-panel.is-open').forEach(hideMedPharmAdhPanel);
    },
    true
  );
}

export {
  buildAdhTriggerHtml,
  buildAdhTriggerHtmlForGroup,
  buildMedCellInner,
  wireMedPharmAdhHoverPanels,
  wireMedPharmAdhHoverOnce,
  adherenceStatsForWindow,
};
