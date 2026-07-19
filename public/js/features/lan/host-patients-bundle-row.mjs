/** @param {object|null|undefined} entry */
export function patientRowFromNestedBundleEntry(entry) {
  if (!entry?.patient?.id) return null;
  const row = { ...entry.patient };
  if (!Array.isArray(row.audit_log) && Array.isArray(entry.audit_log)) {
    row.audit_log = entry.audit_log;
  }
  return row;
}

/** @param {object} entry */
export function patientRowFromFlatBundleEntry(entry) {
  const id = String(entry.id || '').trim();
  if (!id || id.indexOf('demo-') === 0) return null;
  return {
    id,
    nombre: entry.nombre || entry.name || '',
    registro: entry.registro || '',
    sala: entry.sala || '',
    cuarto: entry.cuarto || '',
    cama: entry.cama || '',
    servicio: entry.servicio || '',
    area: entry.area || '',
    edad: entry.edad || '',
    sexo: entry.sexo || '',
    archived: entry.archived,
    registeredByUserId: entry.registeredByUserId,
    registeredAt: entry.registeredAt,
    updatedAt: entry.updatedAt,
    lanUpdatedAt: entry.lanUpdatedAt,
    audit_log: Array.isArray(entry.audit_log) ? entry.audit_log : [],
  };
}
