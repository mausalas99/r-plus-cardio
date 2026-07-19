export { SCHEMA_VERSION, readSchemaVersion, tableExists } from './schema-primitives.mjs';
export {
  applyMigrations,
  migrateToV15LanHostTables,
  migrateToV16UserLastActivity,
  migrateToV17UserActivityBackfill,
} from './schema-migrate-v15-v17.mjs';
export { migrateToV18Equipos } from './schema-migrate-v18-equipos.mjs';
export { migrateToV19EquiposAlertPhotos } from './schema-migrate-v19-equipos-alert-photos.mjs';
export { migrateToV20EquiposPush } from './schema-migrate-v20-equipos-push.mjs';
export { migrateToV21ClinicalSalaCheck } from './schema-migrate-v21-clinical-sala-check.mjs';
