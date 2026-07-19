export class EquiposError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** @param {EquiposError|Error} err */
export function equiposErrorStatus(err) {
  const code = err?.code || 'error';
  if (code === 'not_available' || code === 'not_in_use' || code === 'not_holder') return 409;
  if (code === 'not_in_queue' || code === 'not_next_in_queue') return 409;
  if (
    code === 'invalid_token' ||
    code === 'auth_required' ||
    code === 'admin_required' ||
    code === 'admin_invalid' ||
    code === 'admin_not_configured'
  ) {
    return 403;
  }
  return 400;
}

/** @param {EquiposError|Error} err */
export function jsonEquiposError(err) {
  return {
    error: err?.code || 'error',
    message: err?.message || 'Error en equipos.',
  };
}
