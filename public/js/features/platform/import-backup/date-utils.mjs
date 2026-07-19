/** Date parsing helpers for range export/import. */

function parseDateDMY(value) {
  var t = String(value || '').trim();
  var m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return null;
  var day = parseInt(m[1], 10);
  var month = parseInt(m[2], 10);
  var y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  var d = new Date(y, month - 1, day);
  if (isNaN(d.getTime())) return null;
  if (d.getFullYear() !== y || d.getMonth() !== (month - 1) || d.getDate() !== day) return null;
  return d;
}

function parseDateRangePrompt(raw) {
  var txt = String(raw || '').trim();
  var m = txt.match(/^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+-\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})$/);
  if (!m) return null;
  var from = parseDateDMY(m[1]);
  var to = parseDateDMY(m[2]);
  if (!from || !to) return null;
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  if (from.getTime() > to.getTime()) return null;
  return { from: from, to: to, fromLabel: m[1], toLabel: m[2] };
}

function patientInDateRange(entry, range) {
  var nDate = entry && entry.note ? parseDateDMY(entry.note.fecha) : null;
  var iDate = entry && entry.indicaciones ? parseDateDMY(entry.indicaciones.fecha) : null;
  var nMs = nDate ? nDate.getTime() : null;
  var iMs = iDate ? iDate.getTime() : null;
  var min = range.from.getTime();
  var max = range.to.getTime();
  return (nMs !== null && nMs >= min && nMs <= max) || (iMs !== null && iMs >= min && iMs <= max);
}

export { parseDateDMY, parseDateRangePrompt, patientInDateRange };
