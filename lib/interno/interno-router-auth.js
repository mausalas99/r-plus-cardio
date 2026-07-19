'use strict';

/** @param {import('express').Request} req */
function readInternoAuthCredentials(req) {
  return {
    salaRaw: req.query.sala || req.headers['x-interno-sala'] || req.body?.sala,
    token: String(req.headers['x-interno-token'] || req.query.t || req.body?.token || '').trim(),
  };
}

/**
 * @param {{
 *   getDb: () => import('better-sqlite3').Database | null,
 *   loadEsm: () => Promise<object>,
 * }} ctx
 */
function createInternoAuthMiddleware(ctx) {
  return async function authInterno(req, res, next) {
    try {
      const mod = await ctx.loadEsm();
      const { salaRaw, token } = readInternoAuthCredentials(req);
      const sala = mod.normalizeInternoSala(salaRaw);
      if (!sala || !token) {
        return res.status(401).json({ error: 'auth_required' });
      }

      const db = ctx.getDb?.();
      if (!db) {
        return res.status(503).json({ error: 'db_unavailable' });
      }

      const row = mod.getSalaInternoAccess(db, sala);
      if (!row || row.is_active !== 1) {
        return res.status(403).json({ error: 'interno_inactive' });
      }
      if (!mod.verifySalaInternoToken(db, token, sala)) {
        return res.status(403).json({ error: 'invalid_token' });
      }

      req.internoSala = sala;
      req.internoToken = token;
      next();
    } catch (e) {
      res.status(500).json({ error: e.message || 'auth_failed' });
    }
  };
}

module.exports = { createInternoAuthMiddleware, readInternoAuthCredentials };
