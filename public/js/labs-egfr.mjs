/** Normaliza sexo del expediente (M/F) para CKD-EPI; no usa el encabezado SOME. */
export function normalizePatientSexoForEgfr(sexo) {
  var s = String(sexo == null ? '' : sexo).trim().toUpperCase();
  if (!s) return '';
  if (s === 'F' || s === 'FEMENINO' || s === 'MUJER' || s === 'FEMALE') return 'F';
  if (s === 'M' || s === 'MASCULINO' || s === 'HOMBRE' || s === 'MALE') return 'M';
  return '';
}

/** Edad del paciente en R+ (p. ej. "57", "57 años", "8 meses"). */
export function patientEdadPartsForEgfr(patient) {
  if (!patient) return { edadRaw: '', edadUnidad: 'años' };
  var raw = String(patient.edad == null ? '' : patient.edad).trim();
  if (!raw) return { edadRaw: '', edadUnidad: 'años' };
  var m = raw.match(/^(\d+)\s*(años|meses|días|dias|semanas)?/i);
  if (!m) {
    var n = parseInt(raw, 10);
    return { edadRaw: isFinite(n) ? String(n) : '', edadUnidad: 'años' };
  }
  var unit = (m[2] || 'años').toLowerCase();
  if (unit === 'dias') unit = 'días';
  return { edadRaw: m[1], edadUnidad: unit };
}

/**
 * Demografía para eTFG: sexo (y edad si existe) del paciente en R+.
 * Edad del reporte SOME solo si el expediente no trae edad.
 * @returns {{ edad: string, edadUnidad: string, sexo: 'M'|'F' } | null}
 */
export function buildEgfrPatientCtx(hdrEdadRaw, hdrEdadUnidad, chartPatient) {
  if (!chartPatient) return null;
  var sexo = normalizePatientSexoForEgfr(chartPatient.sexo);
  if (!sexo) return null;
  var edadParts = patientEdadPartsForEgfr(chartPatient);
  return {
    edad: edadParts.edadRaw || hdrEdadRaw || '',
    edadUnidad: edadParts.edadRaw ? edadParts.edadUnidad : hdrEdadUnidad || 'años',
    sexo: sexo,
  };
}

export function ageYearsFromLabDemographics(edadRaw, edadUnidad) {
  var n = parseInt(String(edadRaw == null ? '' : edadRaw).trim(), 10);
  if (!isFinite(n) || n < 0) return null;
  var u = String(edadUnidad || 'años').toLowerCase();
  if (u === 'meses') return n / 12;
  if (u === 'días' || u === 'dias') return n / 365.25;
  if (u === 'semanas') return n / 52.143;
  return n;
}

/**
 * eGFR mL/min/1.73 m² — CKD-EPI 2021 (creatinina, sin raza). Scr en mg/dL; edad ≥ 18.
 * Ref.: CKD-EPI creatinine 2021 (κ, α, 0.9938^edad, ×1.012 si mujer).
 */
export function computeEgfrCkdEpi2021Creatinine(scrMgDl, ageYears, isFemale) {
  var scr = typeof scrMgDl === 'number' ? scrMgDl : parseFloat(String(scrMgDl || '').replace(/,/g, '.'));
  if (!isFinite(scr) || scr <= 0) return null;
  var age = Number(ageYears);
  if (!isFinite(age) || age < 18 || age > 120) return null;
  var k = isFemale ? 0.7 : 0.9;
  var alpha = isFemale ? -0.241 : -0.302;
  var scrK = scr / k;
  var minTerm = Math.min(scrK, 1);
  var maxTerm = Math.max(scrK, 1);
  var egfr =
    142 *
    Math.pow(minTerm, alpha) *
    Math.pow(maxTerm, -1.2) *
    Math.pow(0.9938, age) *
    (isFemale ? 1.012 : 1);
  if (!isFinite(egfr) || egfr <= 0) return null;
  return egfr;
}
