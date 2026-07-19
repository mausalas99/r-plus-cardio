import crypto from 'node:crypto';
import {
  normalizePendientesJson,
  completePendienteItem,
  serializePendientesJson,
} from '../entrega/entrega-pendientes.mjs';
/**
 * @param {object|null|undefined} payload
 */
function normalizeEntregaTemplatePayload(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  return {
    kind: p.kind === 'imagen' ? 'imagen' : 'otro',
    label: String(p.label || '').trim(),
    requires: {
      familiar: !!p.requires?.familiar,
      consentimiento: !!p.requires?.consentimiento,
      anestesia: !!p.requires?.anestesia,
    },
    comentado: !!p.comentado,
    autorizado: !!p.autorizado,
    agendado: !!p.agendado,
  };
}

/** @param {string} raw */
function parseEntregaTemplatePayloadJson(raw) {
  try {
    const parsed = JSON.parse(String(raw || '{}'));
    return normalizeEntregaTemplatePayload(parsed);
  } catch {
    return normalizeEntregaTemplatePayload(null);
  }
}

/** @param {object} row */
function mapEntregaTemplateUserRow(row) {
  return {
    templateId: row.template_id,
    scope: 'user',
    userId: row.user_id,
    name: row.name,
    payload: parseEntregaTemplatePayloadJson(row.payload_json),
    createdAt: row.created_at,
  };
}

/** @param {object} row */
function mapEntregaTemplateTeamRow(row) {
  return {
    templateId: row.template_id,
    scope: 'team',
    teamId: row.team_id,
    name: row.name,
    payload: parseEntregaTemplatePayloadJson(row.payload_json),
    createdBy: row.created_by || null,
    createdAt: row.created_at,
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ patientId: string, itemId: string, completedBy?: object }} opts
 */
export function completeActiveGuardiaPendiente(db, { patientId, itemId, completedBy }) {
  const pid = String(patientId || '');
  const iid = String(itemId || '');
  if (!pid || !iid) return null;

  const row = db
    .prepare(
      `SELECT guardia_id, pendientes_json FROM active_guardias
       WHERE patient_id = ? AND status = 'Active' LIMIT 1`
    )
    .get(pid);
  if (!row) return null;

  const norm = normalizePendientesJson(row.pendientes_json);
  if (!norm.items.some((it) => it.id === iid)) return null;

  const doc = completePendienteItem(row.pendientes_json, iid, completedBy);
  const item = doc.items.find((it) => it.id === iid);
  if (!item) return null;

  db.prepare(`UPDATE active_guardias SET pendientes_json = ? WHERE guardia_id = ?`).run(
    serializePendientesJson(doc),
    row.guardia_id
  );

  return item;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ userId: string, teamIds?: string[] }} opts
 */
export function listEntregaTemplates(db, { userId, teamIds = [] }) {
  const uid = String(userId || '');
  const userRows = uid
    ? db
        .prepare(
          `SELECT template_id, user_id, name, payload_json, created_at
           FROM entrega_template_user
           WHERE user_id = ?
           ORDER BY created_at DESC`
        )
        .all(uid)
    : [];

  const ids = [...new Set((teamIds || []).map((id) => String(id)).filter(Boolean))];
  let teamRows = [];
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(', ');
    teamRows = db
      .prepare(
        `SELECT template_id, team_id, name, payload_json, created_by, created_at
         FROM entrega_template_team
         WHERE team_id IN (${placeholders})
         ORDER BY created_at DESC`
      )
      .all(...ids);
  }

  return {
    user: userRows.map(mapEntregaTemplateUserRow),
    team: teamRows.map(mapEntregaTemplateTeamRow),
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ userId: string, templateId?: string, name: string, payload?: object }} opts
 */
export function saveEntregaTemplateUser(db, { userId, templateId, name, payload }) {
  const uid = String(userId || '');
  const label = String(name || '').trim();
  if (!uid || !label) throw new Error('userId and name are required');

  const payloadJson = JSON.stringify(normalizeEntregaTemplatePayload(payload));
  const id = templateId ? String(templateId) : crypto.randomUUID();

  if (templateId) {
    const result = db
      .prepare(
        `UPDATE entrega_template_user
         SET name = ?, payload_json = ?
         WHERE template_id = ? AND user_id = ?`
      )
      .run(label, payloadJson, id, uid);
    if (result.changes === 0) throw new Error('Plantilla de usuario no encontrada.');
  } else {
    db.prepare(
      `INSERT INTO entrega_template_user (template_id, user_id, name, payload_json)
       VALUES (?, ?, ?, ?)`
    ).run(id, uid, label, payloadJson);
  }

  const row = db
    .prepare(
      `SELECT template_id, user_id, name, payload_json, created_at
       FROM entrega_template_user WHERE template_id = ?`
    )
    .get(id);
  return mapEntregaTemplateUserRow(row);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ teamId: string, createdBy?: string, templateId?: string, name: string, payload?: object }} opts
 */
export function saveEntregaTemplateTeam(db, { teamId, createdBy, templateId, name, payload }) {
  const tid = String(teamId || '');
  const label = String(name || '').trim();
  if (!tid || !label) throw new Error('teamId and name are required');

  const payloadJson = JSON.stringify(normalizeEntregaTemplatePayload(payload));
  const id = templateId ? String(templateId) : crypto.randomUUID();
  const creator = createdBy ? String(createdBy) : null;

  if (templateId) {
    const result = db
      .prepare(
        `UPDATE entrega_template_team
         SET name = ?, payload_json = ?
         WHERE template_id = ? AND team_id = ?`
      )
      .run(label, payloadJson, id, tid);
    if (result.changes === 0) throw new Error('Plantilla de equipo no encontrada.');
  } else {
    db.prepare(
      `INSERT INTO entrega_template_team (template_id, team_id, name, payload_json, created_by)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, tid, label, payloadJson, creator);
  }

  const row = db
    .prepare(
      `SELECT template_id, team_id, name, payload_json, created_by, created_at
       FROM entrega_template_team WHERE template_id = ?`
    )
    .get(id);
  return mapEntregaTemplateTeamRow(row);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ scope: 'user'|'team', templateId: string }} opts
 */
export function deleteEntregaTemplate(db, { scope, templateId }) {
  const id = String(templateId || '');
  if (!id) return false;
  if (scope === 'team') {
    return db.prepare('DELETE FROM entrega_template_team WHERE template_id = ?').run(id).changes > 0;
  }
  if (scope === 'user') {
    return db.prepare('DELETE FROM entrega_template_user WHERE template_id = ?').run(id).changes > 0;
  }
  throw new Error('scope must be "user" or "team"');
}
