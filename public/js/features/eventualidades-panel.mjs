
export {
  normalizeEventualidadText,
  toEventualidadDateValue,
  eventualidadDateToIso,
  appendEventualidad,
  updateEventualidad,
  findEventualidadEntry,
  removeEventualidad,
  sortEntriesDesc,
  dayKeyFromIso,
  formatDayLabel,
  formatDaySubLabel,
  groupEntriesByDay,
} from './eventualidades-store.mjs';
export { registerEventualidadesRuntime } from './eventualidades-store.mjs';
export { renderEventualidadesPanel, invalidateEventualidadesPanel, savePatientEventualidad } from './eventualidades-render.mjs';
export { applyDriveImportEventualidades } from './eventualidades-drive.mjs';
