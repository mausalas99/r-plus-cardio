function normalizeVersionLabel(v) {
  const s = String(v == null ? '' : v).trim();
  return s || 'dev';
}

function parseSemverCoreParts(versionLabel) {
  const s = normalizeVersionLabel(versionLabel);
  if (s === 'dev') return null;
  const core = s.split('-')[0].split('+')[0];
  const parts = core.split('.');
  const nums = [];
  for (let i = 0; i < parts.length; i++) {
    const n = parseInt(parts[i], 10);
    if (Number.isNaN(n)) return null;
    nums.push(n);
  }
  return nums.length ? nums : null;
}

function compareSemverNumericArrays(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] || 0;
    const bi = b[i] || 0;
    if (ai !== bi) return ai > bi ? 1 : -1;
  }
  return 0;
}

function compareSemver(a, b) {
  const pa = parseSemverCoreParts(a);
  const pb = parseSemverCoreParts(b);
  if (pa && pb) return compareSemverNumericArrays(pa, pb);
  const sa = normalizeVersionLabel(a);
  const sb = normalizeVersionLabel(b);
  if (sa === sb) return 0;
  return sa > sb ? 1 : -1;
}

export function semverLt(a, b) {
  return compareSemver(a, b) < 0;
}

export function semverGte(a, b) {
  return compareSemver(a, b) >= 0;
}

function shouldShowGuidedTourIntroBump(currentVersion, storedDoneVersionRaw) {
  const cur = normalizeVersionLabel(currentVersion);
  if (storedDoneVersionRaw == null || String(storedDoneVersionRaw).trim() === '') return true;
  const done = String(storedDoneVersionRaw).trim();
  if (cur === done) return false;
  const pc = parseSemverCoreParts(cur);
  const pd = parseSemverCoreParts(done);
  if (pc && pd) return compareSemverNumericArrays(pc, pd) > 0;
  return cur !== done;
}

export function shouldOfferGuardiaV7Education({
  prevVersion, curVersion, needsOnboarding, trackComplete,
}) {
  if (needsOnboarding) return false;
  if (!prevVersion || !curVersion) return false;
  if (!semverLt(prevVersion, '7.0.0') || !semverGte(curVersion, '7.0.0')) return false;
  if (trackComplete) return false;
  return true;
}

export function shouldShowFundamentosTourIntro({
  curVersion, storedDoneVersion, needsOnboarding,
}) {
  if (needsOnboarding) return false;
  if (storedDoneVersion && semverLt(storedDoneVersion, '7.0.0')) return false;
  return shouldShowGuidedTourIntroBump(curVersion, storedDoneVersion);
}
