import {
  addDaysLocal,
  clipEventToDayColumn,
  assignLanesByInterval,
  AGENDA_DISPLAY_FIRST_HOUR,
  AGENDA_DISPLAY_LAST_HOUR_EXCLUSIVE,
  VISUAL_DURATION_MS,
} from '../procedure-agenda-week.mjs';
import { storage } from '../storage.js';
import { getProcedureAgendaRowPx } from './chrome.mjs';

/** @param {Date} monday */
export function buildAgendaBoardHead(monday) {
  const head = document.createElement('div');
  head.className = 'rpc-proc-agenda-board-head';
  const headSpacer = document.createElement('div');
  headSpacer.className = 'rpc-proc-agenda-head-spacer';
  head.appendChild(headSpacer);
  for (let iDay = 0; iDay < 7; iDay += 1) {
    const colDate = addDaysLocal(monday, iDay);
    const hc = document.createElement('div');
    hc.className = 'rpc-proc-agenda-head-cell';
    let wd = String(colDate.toLocaleDateString('es', { weekday: 'short' })).replace(/\.$/, '');
    let dm = String(colDate.toLocaleDateString('es', { day: 'numeric', month: 'short' })).replace('.', '');
    wd = wd.charAt(0).toUpperCase() + wd.slice(1);
    dm = dm.charAt(0).toUpperCase() + dm.slice(1);
    hc.innerHTML = '<span>' + esc(wd) + '</span><strong>' + esc(dm) + '</strong>';
    head.appendChild(hc);
  }
  return head;
}

/** @param {Date} monday @param {{ start: Date, endExclusive: Date }} week @param {Record<string, string>} pmap */

import { esc } from '../dom-escape.mjs';
export function collectAgendaClipsByDay(monday, week, pmap) {
  const clipsByDay = [[], [], [], [], [], [], []];
  storage.getScheduledProcedures().forEach(function (ev) {
    const evtMs = Date.parse(ev.start);
    if (!Number.isFinite(evtMs)) return;
    if (evtMs >= week.endExclusive.getTime()) return;
    const evEndMs = evtMs + VISUAL_DURATION_MS;
    if (evEndMs <= week.start.getTime()) return;
    if (String(ev.patientId).indexOf('demo-') === 0) return;
    const patientLabel = pmap[ev.patientId] ? pmap[ev.patientId] : 'Paciente desconocido';
    for (let iDay = 0; iDay < 7; iDay += 1) {
      const colDate = addDaysLocal(monday, iDay);
      colDate.setHours(0, 0, 0, 0);
      const clip = clipEventToDayColumn(evtMs, colDate.getTime());
      if (!clip) continue;
      clipsByDay[iDay].push({ ev, clip, patientLabel });
    }
  });
  return clipsByDay;
}

/**
 * @param {number} iDay
 * @param {Date} monday
 * @param {Array<{ ev: object, clip: object, patientLabel: string }>} dayClips
 * @param {(eventId: string) => void} onEdit
 */
export function buildAgendaDayColumn(iDay, monday, dayClips, onEdit) {
  const nh = AGENDA_DISPLAY_LAST_HOUR_EXCLUSIVE - AGENDA_DISPLAY_FIRST_HOUR;
  const agendaRowPx = getProcedureAgendaRowPx();
  const colDate = addDaysLocal(monday, iDay);
  colDate.setHours(0, 0, 0, 0);
  const dayCol = document.createElement('div');
  dayCol.className = 'rpc-proc-agenda-day-col-wrap';
  dayCol.style.height = nh * agendaRowPx + 'px';

  for (let h = AGENDA_DISPLAY_FIRST_HOUR; h < AGENDA_DISPLAY_LAST_HOUR_EXCLUSIVE; h += 1) {
    const hl = document.createElement('div');
    hl.className = 'rpc-proc-agenda-hour-line';
    hl.style.height = agendaRowPx + 'px';
    dayCol.appendChild(hl);
  }

  const intervals = dayClips.map(function (x) {
    return { id: x.ev.id, topMs: x.clip.topMs, botMs: x.clip.botMs };
  });
  const laneById = intervals.length === 0 ? new Map() : assignLanesByInterval(intervals.slice());
  let laneCount = 1;
  laneById.forEach(function (ln) {
    laneCount = Math.max(laneCount, ln + 1);
  });

  dayClips.forEach(function (cell) {
    const clip = cell.clip;
    const ev = cell.ev;
    const visStartMs = clip.visStartMs;
    const blockTopPx = ((clip.topMs - visStartMs) / (60 * 60 * 1000)) * agendaRowPx;
    const blockHtPx = Math.max(((clip.botMs - clip.topMs) / (60 * 60 * 1000)) * agendaRowPx, 18);
    const lane = laneById.get(ev.id) || 0;
    const lcLane = laneCount < 1 ? 1 : laneCount;
    const pctEach = 100 / lcLane;
    const startClock = String(
      new Date(ev.start).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    ).replace('.', '');

    const blk = document.createElement('button');
    blk.type = 'button';
    blk.className = 'rpc-proc-agenda-block';
    blk.style.top = Math.max(0, blockTopPx) + 'px';
    blk.style.height = blockHtPx + 'px';
    if (lcLane <= 1) {
      blk.style.left = '3px';
      blk.style.width = 'calc(100% - 6px)';
    } else {
      blk.style.left = 'calc(' + lane * pctEach + '% + 3px)';
      blk.style.width = 'calc(' + pctEach + '% - 10px)';
    }
    blk.setAttribute('title', (ev.procedure || '') + ' · ' + (ev.location || '') + ' · ' + cell.patientLabel);
    blk.setAttribute('aria-label', 'Editar procedimiento para ' + cell.patientLabel);
    if (!(ev.materialApproved && ev.anesthesiaScheduled)) blk.classList.add('rpc-proc-flag');
    blk.innerHTML =
      '<div class="rpc-proc-name">' + esc(String(ev.procedure || '')) + '</div>' +
      '<div class="rpc-proc-sub">' + esc(String(startClock + ' · ' + (ev.location || ''))) + '</div>' +
      '<div class="rpc-proc-pat">' + esc(String(cell.patientLabel)) + '</div>';
    blk.addEventListener('click', function (e) {
      e.preventDefault();
      onEdit(ev.id);
    });
    dayCol.appendChild(blk);
  });
  return dayCol;
}

/** @param {Date} monday */
export function buildAgendaTimesColumn(_monday) {
  const agendaRowPx = getProcedureAgendaRowPx();
  const timesCol = document.createElement('div');
  timesCol.className = 'rpc-proc-agenda-times-col';
  for (let h = AGENDA_DISPLAY_FIRST_HOUR; h < AGENDA_DISPLAY_LAST_HOUR_EXCLUSIVE; h += 1) {
    const tsl = document.createElement('div');
    tsl.className = 'rpc-proc-agenda-time-slot';
    tsl.style.height = agendaRowPx + 'px';
    tsl.textContent = String(h).padStart(2, '0') + ':00';
    timesCol.appendChild(tsl);
  }
  return timesCol;
}
