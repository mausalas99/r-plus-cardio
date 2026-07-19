/** @param {Request} req @param {Response} res */
export function applyCors(req, res) {
  const rawOrigin = req.headers.get('Origin');
  // Token/admin-gated API; Electron desktop may send null or file:// — allow *.
  const allow = rawOrigin || '*';
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', allow);
  if (allow !== '*') headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET,PUT,POST,PATCH,DELETE,OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Equipos-Token, X-Equipos-Admin-Key'
  );
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** @param {Request} req */
export function corsPreflight(req) {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204 });
}
