'use strict';

const express = require('express');
const { validateHistoriaClinicaPut } = require('./historia-clinica-validate.js');

function mountHistoriaRoutes(r, { store, broadcast, resolver }) {
  r.get('/patients/:patientId/historia-clinica', (req, res) => {
    const roomId = String(req.query.roomId || '').trim();
    if (!roomId) return res.status(400).json({ error: 'roomId_required' });
    const row = store.getEntity({
      entityType: 'historiaClinica',
      entityId: req.params.patientId,
      patientId: req.params.patientId,
      roomId,
    });
    if (!row) return res.status(404).json({ error: 'not_found' });
    res.json({ version: row.version, data: row.data });
  });

  r.put('/patients/:patientId/historia-clinica', express.json({ limit: '2mb' }), async (req, res) => {
    try {
      const validated = validateHistoriaClinicaPut({
        ...req.body,
        patientId: req.params.patientId,
        entityId: req.params.patientId,
      });
      if (!validated.ok) {
        return res.status(400).json({ error: validated.error, paths: validated.paths });
      }
      const mutation = validated.mutation;
      mutation.entityId = req.params.patientId;
      mutation.patientId = req.params.patientId;
      const auditBody = mutation.audit && typeof mutation.audit === 'object' ? mutation.audit : {};
      const auditTemplate = {
        at: new Date().toISOString(),
        clientId: String(mutation.clientId || 'unknown'),
        action: 'historia_clinica.save',
        detail: {
          patientId: req.params.patientId,
          changedKeys: mutation.changedKeys,
          sections: auditBody.sections || mutation.changedKeys,
          safety: Array.isArray(auditBody.safety) ? auditBody.safety : [],
        },
      };
      const out = await store.putHistoriaClinicaQueued(resolver, mutation, auditTemplate);
      broadcast('sync', { type: 'historia-clinica-updated', patientId: req.params.patientId });
      res.json(out);
    } catch (e) {
      if (e.code === 'CONFLICT') {
        return res.status(409).json({
          error: 'conflict',
          entityType: 'historiaClinica',
          entityId: req.params.patientId,
          expectedVersion: e.expectedVersion,
          serverVersion: e.serverVersion,
          serverData: e.serverData,
          clientData: e.clientData,
          conflictingKeys: e.conflictingKeys,
        });
      }
      res.status(400).json({ error: e.message });
    }
  });
}

module.exports = { mountHistoriaRoutes };
