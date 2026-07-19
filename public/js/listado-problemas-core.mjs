// Listado de Problemas — manipulación inmutable.

const SECCIONES = ['activos', 'inactivos'];

function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function emptyListado(fecha, hora) {
  return {
    fecha: String(fecha || ''),
    hora: String(hora || ''),
    activos: [],
    inactivos: []
  };
}

function ensureSeccion(seccion) {
  if (!SECCIONES.includes(seccion)) {
    throw new Error('sección inválida: ' + seccion);
  }
}

export function addProblema(listado, seccion, datos) {
  ensureSeccion(seccion);
  const item = {
    id: nuevoId(),
    fecha: String((datos && datos.fecha) || ''),
    descripcion: String((datos && datos.descripcion) || '')
  };
  return Object.assign({}, listado, {
    [seccion]: (listado[seccion] || []).concat([item])
  });
}

export function removeProblema(listado, seccion, id) {
  ensureSeccion(seccion);
  const arr = listado[seccion] || [];
  const filtered = arr.filter(p => p.id !== id);
  if (filtered.length === arr.length) return listado;
  return Object.assign({}, listado, { [seccion]: filtered });
}

export function reorderProblema(listado, seccion, fromIndex, toIndex) {
  ensureSeccion(seccion);
  const arr = (listado[seccion] || []).slice();
  if (fromIndex < 0 || fromIndex >= arr.length) return listado;
  if (toIndex < 0 || toIndex >= arr.length) return listado;
  const [moved] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, moved);
  return Object.assign({}, listado, { [seccion]: arr });
}
