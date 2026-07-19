'use strict';

const express = require('express');
const { evaluateHostPatientPurgeGuard } = require('./host-patient-ownership.js');
const { resolvePurgeClientIdentity } = require('./host-router-utils.js');

function mountPatientRoutes(r, { store, broadcast, resolver, clientIdentityStore }) {
  r.get('/patients', (_req, res) => {
    const patients = store.getState().patients.filter((p) => p && !p._deleted);
    res.json({ patients });
  });

  r.delete('/patients/:id', (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const registro = String(req.query.registro || '').trim();
      const { clientId, isProgramAdmin } = resolvePurgeClientIdentity(req, clientIdentityStore);
      if (!id) return res.status(400).json({ error: 'patient_id_required' });
      const guard = evaluateHostPatientPurgeGuard(store, id, clientId, isProgramAdmin);
      if (guard.blocked) {
        console.warn('[lan] purge blocked', guard);
        return res.status(403).json({ error: 'owned_by_other_client' });
      }
      const purged = store.purgePatientFromHostCensus(id, registro);
      if (!purged) return res.status(404).json({ error: 'patient_not_found' });
      broadcast('sync', { type: 'patients-updated' });
      res.json({ ok: true, patientId: id });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.put('/patients/:id', express.json({ limit: '2mb' }), (req, res) => {
    try {
      const mutation = {
        entityType: 'patient',
        entityId: req.params.id,
        expectedVersion: Number(req.body.expectedVersion ?? 0),
        changedKeys: req.body.changedKeys || [],
        baseData: req.body.baseData,
        data: { ...req.body.data, id: req.params.id },
        op: req.body.op,
      };
      if (!mutation.changedKeys.length && mutation.expectedVersion > 0) {
        return res.status(400).json({ error: 'changedKeys_required' });
      }
      const out = resolver.applyMutation(mutation);
      if (out && out.data && out.data.archived === true) {
        store.archiveHistoriaClinicaForPatient(req.params.id);
      }
      broadcast('sync', { type: 'patients-updated' });
      res.json(out);
    } catch (e) {
      if (e.code === 'CONFLICT') {
        return res.status(409).json({
          error: 'conflict',
          entityType: 'patient',
          entityId: req.params.id,
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

module.exports = { mountPatientRoutes };
