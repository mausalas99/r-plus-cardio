'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadEquiposEsm } = require('./equipos-router-ws.js');

const MAX_PHOTO_BYTES = 1024 * 1024;

function handleEquiposErr(res, err) {
  const code = err?.code || 'error';
  const message = err?.message || 'Error en equipos.';
  const status =
    code === 'not_available' ||
    code === 'not_in_use' ||
    code === 'not_holder' ||
    code === 'not_in_queue' ||
    code === 'not_next_in_queue'
      ? 409
      : 400;
  res.status(status).json({ error: code, message });
}

/**
 * @param {{
 *   getDb: () => import('better-sqlite3').Database | null,
 *   photosDir: string,
 * }} deps
 */
function createEquiposRouterContext(deps) {
  fs.mkdirSync(deps.photosDir, { recursive: true });

  async function authEquipos(req, res, next) {
    try {
      const mod = await loadEquiposEsm();
      const token = String(
        req.headers['x-equipos-token'] || req.query.t || req.body?.token || ''
      ).trim();
      const db = deps.getDb?.();
      if (!token || !db) {
        return res.status(401).json({ error: 'auth_required', message: 'Falta autenticación.' });
      }
      if (!mod.verifyEquiposToken(db, token)) {
        return res.status(403).json({ error: 'invalid_token', message: 'Código inválido.' });
      }
      req.equiposDb = db;
      req.equiposMod = mod;
      next();
    } catch (e) {
      res.status(500).json({ error: 'auth_failed', message: e.message || 'Error de autenticación.' });
    }
  }

  /**
   * @param {string} photoBase64
   * @param {{ deviceType: string, photoKind: string, sessionId?: string }} meta
   */
  async function savePhotoFromBase64(photoBase64, meta) {
    const mod = await loadEquiposEsm();
    const raw = String(photoBase64 || '');
    const m = /^data:image\/\w+;base64,(.+)$/i.exec(raw);
    const b64 = m ? m[1] : raw;
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length || buf.length > MAX_PHOTO_BYTES) {
      throw new mod.EquiposError('photo_too_large', 'La foto es demasiado grande.');
    }
    const id = mod.newEquiposId();
    const filePath = path.join(deps.photosDir, `${id}.jpg`);
    fs.writeFileSync(filePath, buf);
    const db = deps.getDb();
    if (db) {
      mod.insertEquiposPhotoRow(db, {
        id,
        sessionId: meta.sessionId || null,
        deviceType: meta.deviceType,
        photoKind: meta.photoKind,
        filePath,
        capturedAt: new Date().toISOString(),
      });
    }
    return id;
  }

  return { authEquipos, savePhotoFromBase64, handleEquiposErr };
}

module.exports = { createEquiposRouterContext, MAX_PHOTO_BYTES };
