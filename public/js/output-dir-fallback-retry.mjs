import { isOutputDirError } from './output-dir-fallback.mjs';

/** @param {object} opts */
export async function retryOutputDirFallback(opts) {
  if (typeof opts.onPrompt === 'function') opts.onPrompt(opts.error);
  const dir = await opts.selectOutputDir();
  if (!dir) {
    if (typeof opts.onCancel === 'function') opts.onCancel(opts.error);
    return { status: 'cancelled' };
  }
  if (typeof opts.saveOutputDir === 'function') opts.saveOutputDir(dir);
  const retryResponse = await opts.retry(dir);
  if (retryResponse && retryResponse.ok) {
    if (typeof opts.onSuccess === 'function') opts.onSuccess(retryResponse);
    return { status: 'retried' };
  }
  const retryError = retryResponse && retryResponse.error ? retryResponse.error : opts.error;
  if (typeof opts.onError === 'function') opts.onError(retryError);
  return { status: 'retry_error' };
}

/** @param {object} opts */
export async function handleOutputDirErrorPath(opts) {
  if (!isOutputDirError(opts.error) || typeof opts.selectOutputDir !== 'function') {
    if (typeof opts.onError === 'function') opts.onError(opts.error);
    return { status: 'error' };
  }
  return retryOutputDirFallback(opts);
}

/** @param {object} opts */
export async function handleOutputDirFallback(opts) {
  var response = opts && opts.response;
  if (response && response.ok) {
    if (typeof opts.onSuccess === 'function') opts.onSuccess(response);
    return { status: 'ok' };
  }
  var error = response && response.error ? response.error : 'No se pudo generar el documento.';
  return handleOutputDirErrorPath({ ...opts, error });
}
