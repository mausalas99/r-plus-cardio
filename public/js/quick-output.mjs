// Decide qué documento debe exportar la "Salida rápida" según el modo
// de la app (Sala/Interconsulta), la pestaña interna activa, el formato
// configurado y el estado del Listado de Problemas. Sin DOM ni red.
//
// kind retornados:
//   'html' | 'txt'                — el formato configurado fuerza el destino.
//   'listado'                     — Sala con problemas: generar Listado de Problemas.
//   'listado_empty'               — Sala sin problemas: mostrar toast (no genera doc).
//   'indicaciones'                — Interconsulta + tab indica: generar Indicaciones.
//   'nota'                        — fallback Interconsulta: generar Nota de evolución.

export function listadoHasProblems(listado) {
  if (!listado || typeof listado !== 'object') return false;
  const has = (arr) =>
    Array.isArray(arr)
    && arr.some((p) => p && typeof p.descripcion === 'string' && p.descripcion.trim().length > 0);
  return has(listado.activos) || has(listado.inactivos);
}

export function resolveQuickOutputAction(opts) {
  const format = String(opts && opts.format || 'docx').toLowerCase();
  if (format === 'html') return { kind: 'html' };
  if (format === 'txt')  return { kind: 'txt' };

  const sala = opts && opts.appMode === 'sala';
  if (sala) {
    if (listadoHasProblems(opts.listado)) return { kind: 'listado' };
    return {
      kind: 'listado_empty',
      message: 'Agrega un problema al Listado para usar Salida rápida en Sala.',
    };
  }

  if (opts && opts.activeInner === 'indica') return { kind: 'indicaciones' };
  return { kind: 'nota' };
}
