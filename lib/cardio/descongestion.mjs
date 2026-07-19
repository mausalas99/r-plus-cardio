function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

export function daysBetweenInclusive(fromYmd, toYmd) {
  const a = parseYmd(fromYmd);
  const b = parseYmd(toYmd);
  if (!a || !b) return 0;
  const ms = b.getTime() - a.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 86400000) + 1;
}

export function computeDescongestion(input) {
  const overrides = input.overrides || {};
  const diuresisSum = (input.dailyDiuresisMl || []).reduce((s, n) => s + (Number(n) || 0), 0);
  return {
    diasInternamiento: daysBetweenInclusive(input.ingresoDate, input.asOfDate),
    diasDescongestion: daysBetweenInclusive(input.inicioDescongestion, input.asOfDate),
    diuresisAcumuladaMl:
      overrides.diuresisAcumuladaMl != null
        ? Number(overrides.diuresisAcumuladaMl)
        : diuresisSum,
    furosemidaAcumuladaMg:
      overrides.furosemidaAcumuladaMg != null
        ? Number(overrides.furosemidaAcumuladaMg)
        : Number(input.furosemidaAcumuladaMg) || 0,
  };
}

export function applyAcumuladoOverride(state, key, value) {
  const overrides = Object.assign({}, state.overrides || {});
  overrides[key] = value;
  return Object.assign({}, state, { overrides });
}

export function clearAcumuladoOverride(state, key) {
  const overrides = Object.assign({}, state.overrides || {});
  delete overrides[key];
  return Object.assign({}, state, { overrides });
}
