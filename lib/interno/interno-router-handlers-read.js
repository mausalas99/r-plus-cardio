'use strict';

/**
 * @param {{
 *   loadEsm: () => Promise<object>,
 *   readBoard: (sala: string) => Promise<object|null>,
 * }} ctx
 */
function createInternoBoardGetHandler(ctx) {
  return async function handleInternoBoardGet(req, res) {
    try {
      const board = await ctx.readBoard(req.internoSala);
      if (!board) return res.status(400).json({ error: 'invalid_sala' });
      res.json(board);
    } catch (e) {
      res.status(500).json({ error: e.message || 'board_failed' });
    }
  };
}

/**
 * @param {{ loadEsm: () => Promise<object> }} ctx
 */
function createInternoQrGetHandler(ctx) {
  return async function handleInternoQrGet(req, res) {
    try {
      const data = String(req.query.data || '').trim();
      if (!data || data.length > 2048) {
        return res.status(400).json({ error: 'data_required' });
      }
      const mod = await ctx.loadEsm();
      res.type('image/svg+xml').send(mod.renderQrSvg(data));
    } catch (e) {
      res.status(500).json({ error: e.message || 'qr_failed' });
    }
  };
}

module.exports = {
  createInternoBoardGetHandler,
  createInternoQrGetHandler,
};
