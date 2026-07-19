import { EQUIPOS_PUSH_SUBSCRIPTIONS_DDL } from '../equipos/equipos-push-ddl.mjs';

/** @param {import('better-sqlite3').Database} db */
export function migrateToV20EquiposPush(db) {
  db.exec(EQUIPOS_PUSH_SUBSCRIPTIONS_DDL);
  db.prepare(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('schema_version', '20');
}
