'use strict';

/** @param {object|null|undefined} board @param {string} patientId */
function boardIncludesPatient(board, patientId) {
  return !!board?.patients?.some((p) => p.id === patientId);
}

/**
 * @param {{
 *   readBoard: (sala: string) => Promise<object|null>,
 * }} ctx
 * @param {import('express').Response} res
 * @param {string} sala
 * @param {string} patientId
 */
async function assertInternoPatientOnBoard(ctx, res, sala, patientId) {
  const board = await ctx.readBoard(sala);
  if (!board?.active) {
    res.status(403).json({ error: 'interno_inactive' });
    return null;
  }
  if (!boardIncludesPatient(board, patientId)) {
    res.status(403).json({ error: 'patient_out_of_scope' });
    return null;
  }
  return board;
}

module.exports = { boardIncludesPatient, assertInternoPatientOnBoard };
