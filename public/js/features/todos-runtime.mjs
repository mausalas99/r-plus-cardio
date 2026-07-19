/** Pendientes — shared runtime bridge. */
import {
  TODO_FILTER_ALL,
} from '../todos-handoff.mjs';

var listFilter = TODO_FILTER_ALL;

var rt = {
  getActiveId() {
    return null;
  },
  getActiveAppTab() {
    return 'lab';
  },
  getRoundOverviewMode() {
    return false;
  },
  getSettings() {
    return {};
  },
  renderPaseBoard() {},
};

export function registerTodosRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

export function aid() {
  return rt.getActiveId();
}

export function getClinicalUsername() {
  var st = rt.getSettings() || {};
  var u = st.clinicalUsername;
  return u ? String(u) : null;
}

export function getTodosRuntime() {
  return rt;
}

export function getListFilter() {
  return listFilter;
}

export function setListFilter(value) {
  listFilter = value;
}
