import { indexBy, pickLastWriteRow } from './clinical-ops-sync-merge-utils.mjs';

export function mergeEntregaTemplateUser(db, localRows, incomingRows) {
  const localById = indexBy(localRows, 'template_id');
  const incomingById = indexBy(incomingRows, 'template_id');
  const allIds = new Set([...localById.keys(), ...incomingById.keys()]);

  for (const templateId of allIds) {
    const winner = pickLastWriteRow(localById.get(templateId), incomingById.get(templateId), 'created_at');
    if (!winner?.user_id) continue;

    const existing = db
      .prepare(`SELECT template_id FROM entrega_template_user WHERE template_id = ?`)
      .get(templateId);
    if (existing) {
      db.prepare(
        `UPDATE entrega_template_user SET user_id = ?, name = ?, payload_json = ? WHERE template_id = ?`
      ).run(String(winner.user_id), winner.name, winner.payload_json, templateId);
    } else {
      try {
        db.prepare(
          `INSERT INTO entrega_template_user (template_id, user_id, name, payload_json, created_at)
           VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`
        ).run(
          templateId,
          String(winner.user_id),
          winner.name,
          winner.payload_json,
          winner.created_at ? String(winner.created_at) : null
        );
      } catch {
        /* skip rows whose user_id still cannot be satisfied */
      }
    }
  }
}

export function mergeEntregaTemplateTeam(db, localRows, incomingRows) {
  const localById = indexBy(localRows, 'template_id');
  const incomingById = indexBy(incomingRows, 'template_id');
  const allIds = new Set([...localById.keys(), ...incomingById.keys()]);

  for (const templateId of allIds) {
    const winner = pickLastWriteRow(localById.get(templateId), incomingById.get(templateId), 'created_at');
    if (!winner?.team_id) continue;

    const existing = db
      .prepare(`SELECT template_id FROM entrega_template_team WHERE template_id = ?`)
      .get(templateId);
    if (existing) {
      db.prepare(
        `UPDATE entrega_template_team
         SET team_id = ?, name = ?, payload_json = ?, created_by = ?
         WHERE template_id = ?`
      ).run(
        String(winner.team_id),
        winner.name,
        winner.payload_json,
        winner.created_by ?? null,
        templateId
      );
    } else {
      try {
        db.prepare(
          `INSERT INTO entrega_template_team
             (template_id, team_id, name, payload_json, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
        ).run(
          templateId,
          String(winner.team_id),
          winner.name,
          winner.payload_json,
          winner.created_by ?? null,
          winner.created_at ? String(winner.created_at) : null
        );
      } catch {
        /* skip rows whose team_id still cannot be satisfied */
      }
    }
  }
}
