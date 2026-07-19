'use strict';

const { createBearerAuthMiddleware } = require('./bearer-auth.js');

function mountCoreRoutes(r, { getState, getHostClinicalMeta, getHealthExtras }) {
  r.get('/health', (_req, res) => {
    const meta =
      typeof getHostClinicalMeta === 'function'
        ? getHostClinicalMeta()
        : { rank: 'R1', isProgramAdmin: false, isOnCallGuardia: false, startedAt: 0, updatedAt: '' };
    const extras = typeof getHealthExtras === 'function' ? getHealthExtras() : {};
    res.json({
      lan: true,
      dbUnlocked: extras.dbUnlocked != null ? !!extras.dbUnlocked : false,
      shiftPinActive: extras.shiftPinActive != null ? !!extras.shiftPinActive : false,
      hostRank: String(meta.rank || 'R1').trim() || 'R1',
      clientId: String(extras.clientId || '').trim(),
      startedAt: Number(meta.startedAt) || 0,
      revision: Number(extras.revision) || 0,
    });
  });

  r.use(createBearerAuthMiddleware(getState));

  r.get('/ping', (_req, res) => {
    res.json({ ok: true, lan: true });
  });

  r.get('/host-rank', (_req, res) => {
    const meta =
      typeof getHostClinicalMeta === 'function'
        ? getHostClinicalMeta()
        : { rank: 'R1', isProgramAdmin: false, startedAt: 0 };
    res.json({
      rank: String(meta.rank || 'R1').trim() || 'R1',
      isProgramAdmin: !!meta.isProgramAdmin,
      isOnCallGuardia: !!meta.isOnCallGuardia,
      startedAt: Number(meta.startedAt) || 0,
    });
  });
}

module.exports = { mountCoreRoutes };
