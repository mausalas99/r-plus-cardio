import { EquiposError } from './errors.js';

/** @param {string} s */
export function normalizeEquiposSecret(s) {
  return String(s || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

/** @param {string} a @param {string} b */
function timingSafeEqual(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length) return false;
  let out = 0;
  for (let i = 0; i < x.length; i++) out |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return out === 0;
}

/** @param {import('@cloudflare/workers-types').D1Database} db */
export async function getEquiposProgramAccess(db) {
  return db
    .prepare(
      `SELECT id, access_token, is_active, rotated_at, rotated_by
       FROM equipos_program_access WHERE id = 1`
    )
    .first();
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {string} token */
export async function verifyEquiposToken(db, token) {
  const row = await getEquiposProgramAccess(db);
  if (!row || row.is_active !== 1) return false;
  const a = String(token || '').trim();
  const b = String(row.access_token || '').trim();
  if (!a || !b) return false;
  return timingSafeEqual(a, b);
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {string} [rotatedBy] */
export async function rotateEquiposProgramToken(db, rotatedBy) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE equipos_program_access
       SET access_token = ?, rotated_at = ?, rotated_by = ?, is_active = 1
       WHERE id = 1`
    )
    .bind(token, now, rotatedBy || null)
    .run();
  return getEquiposProgramAccess(db);
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {boolean} active */
export async function setEquiposProgramActive(db, active) {
  await db
    .prepare(`UPDATE equipos_program_access SET is_active = ? WHERE id = 1`)
    .bind(active ? 1 : 0)
    .run();
  return getEquiposProgramAccess(db);
}

/** @param {import('@cloudflare/workers-types').ExecutionContext} env */
export function verifyAdminKey(env, key) {
  const expected = normalizeEquiposSecret(env.EQUIPOS_ADMIN_KEY);
  const got = normalizeEquiposSecret(key);
  if (!expected || !got) return false;
  return timingSafeEqual(got, expected);
}

/** @param {Request} req @param {import('@cloudflare/workers-types').ExecutionContext} env */
export function extractAuth(req, env) {
  const token = String(
    req.headers.get('x-equipos-token') ||
      new URL(req.url).searchParams.get('t') ||
      ''
  ).trim();
  const adminKey = normalizeEquiposSecret(
    req.headers.get('x-equipos-admin-key') ||
      new URL(req.url).searchParams.get('ak') ||
      ''
  );
  const isAdmin = verifyAdminKey(env, adminKey);
  return { token, adminKey, isAdmin };
}

/**
 * @param {Request} req
 * @param {import('@cloudflare/workers-types').ExecutionContext} env
 * @param {{ adminKey?: string } | null} [body]
 */
export function resolveAdminCredential(req, env, body = null) {
  const auth = extractAuth(req, env);
  const fromBody = body?.adminKey != null ? normalizeEquiposSecret(body.adminKey) : '';
  const adminKey = auth.adminKey || fromBody;
  const isAdmin = verifyAdminKey(env, adminKey);
  return {
    ...auth,
    adminKey,
    isAdmin,
    serverConfigured: !!normalizeEquiposSecret(env.EQUIPOS_ADMIN_KEY),
  };
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{ token: string, isAdmin: boolean }} auth
 */
export async function assertEquiposAuth(db, auth) {
  if (auth.isAdmin) return;
  if (auth.adminKey) {
    throw new EquiposError('admin_invalid', 'Clave de administrador incorrecta.');
  }
  if (!auth.token) throw new EquiposError('auth_required', 'Falta autenticación.');
  const ok = await verifyEquiposToken(db, auth.token);
  if (!ok) throw new EquiposError('invalid_token', 'Código inválido.');
}

/** @param {import('@cloudflare/workers-types').ExecutionContext} env @param {{ isAdmin?: boolean, adminKey?: string, serverConfigured?: boolean }} auth */
export function assertAdminAuth(env, auth) {
  const configured = auth.serverConfigured ?? !!normalizeEquiposSecret(env.EQUIPOS_ADMIN_KEY);
  if (!configured) {
    throw new EquiposError(
      'admin_not_configured',
      'El worker no tiene EQUIPOS_ADMIN_KEY (wrangler secret put EQUIPOS_ADMIN_KEY).'
    );
  }
  if (auth.adminKey && !auth.isAdmin) {
    throw new EquiposError('admin_invalid', 'Clave de administrador incorrecta.');
  }
  if (!auth.isAdmin) {
    throw new EquiposError('admin_required', 'Se requiere clave de administrador.');
  }
}
