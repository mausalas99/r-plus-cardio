import {
  renderSomeReportTablesHtml,
  wireSomeTableExportButtons,
} from '../labs-some-table.mjs';

let rt = {
  showToast() {},
  getParsed() {
    return null;
  },
  isPaseMode() {
    return false;
  },
  syncLabCopyFab() {},
  syncLabOutputChrome() {},
};

export function registerLabSomeTablesModalRuntime(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  Object.assign(rt, ctx);
}

export function syncLabSomeTablesBtn(show) {
  var btn = document.getElementById('lab-some-tables-btn');
  if (!btn) return;
  var visible = !!show;
  if (visible) {
    btn.removeAttribute('hidden');
    btn.setAttribute('aria-hidden', 'false');
  } else {
    btn.setAttribute('hidden', '');
    btn.setAttribute('aria-hidden', 'true');
  }
}

export function openLabSomeTablesModal() {
  if (rt.isPaseMode()) return;
  var parsed = rt.getParsed();
  if (!parsed || !parsed.departments || !parsed.departments.length) return;
  var backdrop = document.getElementById('lab-some-tables-backdrop');
  var body = document.getElementById('lab-some-tables-modal-body');
  if (!backdrop || !body) return;
  body.innerHTML = renderSomeReportTablesHtml(parsed, {
    hideGroupTitles: true,
    modalLayout: true,
  });
  wireSomeTableExportButtons(body, function (msg, kind) {
    rt.showToast(msg, kind);
  }, {
    getDept: function (deptIndex) {
      return parsed.departments && parsed.departments[deptIndex]
        ? parsed.departments[deptIndex]
        : null;
    },
    getGroup: function (deptIndex, groupIndex) {
      var dept = parsed.departments && parsed.departments[deptIndex];
      return dept && dept.groups ? dept.groups[groupIndex] : null;
    },
  });
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('lab-some-tables-modal-open');
  rt.syncLabCopyFab(false);
}

export function closeLabSomeTablesModal() {
  var backdrop = document.getElementById('lab-some-tables-backdrop');
  var body = document.getElementById('lab-some-tables-modal-body');
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('lab-some-tables-modal-open');
  if (body) body.innerHTML = '';
  rt.syncLabOutputChrome();
}
