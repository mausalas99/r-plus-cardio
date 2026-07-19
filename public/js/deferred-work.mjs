/** Diferir trabajo pesado para no bloquear el cambio de pestaña. */

let idleGeneration = 0;
let afterPaintGeneration = 0;

/** Invalida callbacks pendientes de scheduleIdle / scheduleAfterPaint (p. ej. al cambiar de pestaña). */
export function cancelDeferredIdleWork() {
  idleGeneration += 1;
  afterPaintGeneration += 1;
  return idleGeneration;
}

export function scheduleAfterPaint(fn) {
  if (typeof fn !== 'function') return;
  const gen = afterPaintGeneration;
  const run = function () {
    if (gen !== afterPaintGeneration) return;
    fn();
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(function () {
      requestAnimationFrame(run);
    });
    return;
  }
  setTimeout(run, 0);
}

export function scheduleIdle(fn, timeoutMs) {
  if (typeof fn !== 'function') return;
  const gen = idleGeneration;
  const timeout = timeoutMs == null ? 150 : timeoutMs;
  const run = function () {
    if (gen !== idleGeneration) return;
    fn();
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: timeout });
    return;
  }
  setTimeout(run, 0);
}
