// Edad calculada desde fecha de nacimiento. Usa UTC para evitar drift de timezone.

const DOB_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDobToUTC(dob) {
  if (typeof dob !== 'string') return null;
  const m = DOB_RE.exec(dob);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ts = Date.UTC(y, mo - 1, d);
  const date = new Date(ts);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return ts;
}

function asOfToUTCDay(asOf) {
  const d = asOf instanceof Date ? asOf : new Date(asOf);
  if (isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function calculateAge(dob, asOf = new Date()) {
  const dobMs = parseDobToUTC(dob);
  const todayMs = asOfToUTCDay(asOf);
  if (dobMs == null || todayMs == null) return null;
  if (dobMs > todayMs) return null;

  const dobD = new Date(dobMs);
  const todayD = new Date(todayMs);
  const dy = dobD.getUTCFullYear();
  const ty = todayD.getUTCFullYear();
  if (ty - dy > 120) return null;

  let years = ty - dy;
  const dmd = (dobD.getUTCMonth() * 100) + dobD.getUTCDate();
  const tmd = (todayD.getUTCMonth() * 100) + todayD.getUTCDate();
  if (tmd < dmd) years -= 1;

  if (years >= 1) return { value: years, unit: 'años', display: years + ' años' };

  let months = (todayD.getUTCFullYear() - dobD.getUTCFullYear()) * 12 + (todayD.getUTCMonth() - dobD.getUTCMonth());
  if (todayD.getUTCDate() < dobD.getUTCDate()) months -= 1;
  if (months >= 1) return { value: months, unit: 'meses', display: months + ' meses' };

  const days = Math.floor((todayMs - dobMs) / (24 * 60 * 60 * 1000));
  return { value: days, unit: 'días', display: days + ' días' };
}

export function formatDobForDocs(dob) {
  const m = DOB_RE.exec(typeof dob === 'string' ? dob : '');
  if (!m) return '';
  return m[3] + '/' + m[2] + '/' + m[1];
}
