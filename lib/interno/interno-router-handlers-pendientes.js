'use strict';

const { assertInternoPatientOnBoard } = require('./interno-router-handlers-shared.js');

/** @param {import('express').Request} req */
function readPendienteRouteParams(req) {
  return {
    patientId: String(req.params.patientId || '').trim(),
    itemId: String(req.params.itemId || '').trim(),
  };
}

/** @param {import('express').Request} req */
function buildInternoCompletedBy(req) {
  const reporterName = String(req.body?.reporterName || '').trim();
  return {
    kind: 'interno',
    ...(reporterName ? { name: reporterName } : {}),
  };
}

/** @param {import('express').Response} res @param {{ ok: boolean, error?: string, item?: object }} result */
function respondPendientePatchResult(res, result) {
  if (result.ok) {
    res.json({ ok: true, item: result.item });
    return;
  }
  if (result.error === 'guardia_not_found' || result.error === 'item_not_found') {
    res.status(404).json({ error: result.error });
    return;
  }
  res.status(400).json({ error: result.error });
}

/**
 * @param {{
 *   getDb: () => import('better-sqlite3').Database | null,
 *   broadcastSync?: (name: string, obj: object) => void,
 *   loadEsm: () => Promise<object>,
 *   readBoard: (sala: string) => Promise<object|null>,
 *   broadcastInterno: (sala: string, obj: object) => void,
 * }} ctx
 */
function createInternoPendientePatchHandler(ctx) {
  return async function handleInternoPendientePatch(req, res) {
    try {
      const { patientId, itemId } = readPendienteRouteParams(req);
      if (!patientId || !itemId) {
        return res.status(400).json({ error: 'patient_or_item_required' });
      }

      const board = await assertInternoPatientOnBoard(ctx, res, req.internoSala, patientId);
      if (!board) return;

      const db = ctx.getDb?.();
      if (!db) return res.status(503).json({ error: 'db_unavailable' });

      const mod = await ctx.loadEsm();
      const result = mod.patchGuardiaPendienteComplete(
        db,
        patientId,
        itemId,
        buildInternoCompletedBy(req)
      );
      if (!result.ok) {
        respondPendientePatchResult(res, result);
        return;
      }

      if (typeof ctx.broadcastSync === 'function') {
        ctx.broadcastSync('sync', { type: 'guardias-updated' });
      }
      ctx.broadcastInterno(req.internoSala, { type: 'board-changed', patientId, itemId });
      respondPendientePatchResult(res, result);
    } catch (e) {
      res.status(500).json({ error: e.message || 'pendiente_failed' });
    }
  };
}

module.exports = { createInternoPendientePatchHandler };
