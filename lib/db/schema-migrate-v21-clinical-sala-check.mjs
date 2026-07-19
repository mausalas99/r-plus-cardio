import { clinicalSalaSqlCheck } from '../clinical-salas.mjs';
import { tableExists } from './schema-primitives.mjs';
import {
  migrateSalaInternoAccessV11,
  migrateTeamsTableV11,
  migrateUsersTableV11,
  seedSalaInternoTokensV11,
} from './schema-migrate-v11-helpers.mjs';

/** Widen users/teams/sala_interno_access sala CHECK to full CLINICAL_SALA_VALUES (Interconsultas, UX, Eme). */
export function migrateToV21ClinicalSalaCheck(db) {
  const salaCheck = clinicalSalaSqlCheck({ allowNull: true });
  const salaCheckNotNull = clinicalSalaSqlCheck({ allowNull: false });
  migrateUsersTableV11(db, salaCheck);
  migrateTeamsTableV11(db, salaCheck);
  if (tableExists(db, 'users')) {
    migrateSalaInternoAccessV11(db, salaCheckNotNull);
    seedSalaInternoTokensV11(db);
  }
  db.prepare(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('schema_version', '21');
}
