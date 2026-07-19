export function isOutputDirError(message) {
  var text = String(message || '').toLowerCase();
  return text.indexOf('carpeta seleccionada') !== -1
    || text.indexOf('no se puede escribir') !== -1
    || text.indexOf('ruta de exportación') !== -1
    || text.indexOf('eacces') !== -1
    || text.indexOf('enoent') !== -1;
}

export { handleOutputDirFallback } from './output-dir-fallback-retry.mjs';
