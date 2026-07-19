export function canonicalStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(sortValue);
  const keys = Object.keys(v).sort();
  const out = {};
  for (const k of keys) out[k] = sortValue(v[k]);
  return out;
}
