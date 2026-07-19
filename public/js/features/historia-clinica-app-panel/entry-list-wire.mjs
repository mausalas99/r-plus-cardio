import { wireFlexibleDate } from './flex-date.mjs';

export function wireEntryList(host, list, rowAttr, fieldAttr, onDateChange, emit, rerender) {
  host.querySelectorAll('.hc-flex-date').forEach(wireFlexibleDate);
  host.querySelectorAll('[' + 'data-' + fieldAttr + ']').forEach(function (el) {
    el.addEventListener('input', function () {
      const row = el.closest('[data-' + rowAttr + '-idx]');
      const idx = Number(row.getAttribute('data-' + rowAttr + '-idx'));
      const key = el.getAttribute('data-' + fieldAttr);
      if (!list[idx]) return;
      list[idx][key] = el.value;
      emit();
    });
  });
  host.querySelectorAll('[data-' + rowAttr + '-remove]').forEach(function (btn) {
    btn.onclick = function () {
      list.splice(Number(btn.getAttribute('data-' + rowAttr + '-remove')), 1);
      rerender();
      emit();
    };
  });
  host.querySelectorAll('.hc-flex-date').forEach(function (wrap) {
    wrap.querySelectorAll('input,select').forEach(function (el) {
      el.addEventListener('change', function () {
        const row = wrap.closest('[data-' + rowAttr + '-idx]');
        const idx = Number(row.getAttribute('data-' + rowAttr + '-idx'));
        onDateChange(idx, wrap);
        emit();
      });
    });
  });
}
